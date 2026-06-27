/* Server-side mirror of the palette/theme logic from script.js
   so the OG image and the landing page use IDENTICAL branding. */

import UPNG from "upng-js";
import jpeg from "jpeg-js";

const PROVIDERS = [
  { name: "jupiter",     url: "https://tokens.jup.ag/token/{ca}" },
  { name: "dexscreener", url: "https://api.dexscreener.com/latest/dex/tokens/{ca}" },
];
const FALLBACK = { name: "Solana Token", symbol: "TOKEN", image: "" };

export async function fetchMetadata(ca) {
  for (const p of PROVIDERS) {
    try {
      const res = await fetch(p.url.replace("{ca}", ca), {
        headers: { accept: "application/json" },
        cf: { cacheTtl: 300, cacheEverything: true },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const m = normalize(p.name, data);
      if (m && (m.image || m.name)) return m;
    } catch (_) { /* try next */ }
  }
  return { ...FALLBACK, links: {} };
}

function normalize(provider, data) {
  if (provider === "jupiter" && data && data.address) {
    return {
      name: data.name || FALLBACK.name,
      symbol: data.symbol || FALLBACK.symbol,
      image: data.logoURI || "",
    };
  }
  if (provider === "dexscreener" && data && Array.isArray(data.pairs) && data.pairs.length) {
    const pair = data.pairs[0];
    const base = pair.baseToken || {};
    const info = pair.info || {};
    const image = info.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${base.address}.png`;
    return {
      name: base.name || FALLBACK.name,
      symbol: base.symbol || FALLBACK.symbol,
      image,
    };
  }
  return null;
}

/* Route arbitrary remote logos through a CORS+resize proxy so we can
   decode pixels reliably and keep payload small. */
export function proxify(url, size = 96) {
  if (!url) return url;
  const stripped = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${size}&h=${size}&fit=cover&output=png&n=-1`;
}

/* Decode PNG or JPEG bytes -> { data: Uint8Array RGBA, width, height } */
function decode(buf, contentType) {
  const bytes = new Uint8Array(buf);
  // PNG magic
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const img = UPNG.decode(bytes);
    const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);
    return { data: rgba, width: img.width, height: img.height };
  }
  // JPEG magic
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const img = jpeg.decode(bytes, { useTArray: true });
    return { data: img.data, width: img.width, height: img.height };
  }
  // Try by content-type fallback
  if (contentType && contentType.includes("png")) {
    const img = UPNG.decode(bytes);
    return { data: new Uint8Array(UPNG.toRGBA8(img)[0]), width: img.width, height: img.height };
  }
  if (contentType && contentType.includes("jpeg")) {
    const img = jpeg.decode(bytes, { useTArray: true });
    return { data: img.data, width: img.width, height: img.height };
  }
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}
function rgbToHex({ r, g, b }) { return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join(""); }
function luminance({ r, g, b }) {
  const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
}
function bestTextOn(rgb) { return luminance(rgb) > .45 ? "#0c0c10" : "#ffffff"; }
function clamp(v) { return Math.max(0, Math.min(255, v | 0)); }
function lighten({ r, g, b }, amt) {
  return { r: clamp(r + (255 - r) * amt), g: clamp(g + (255 - g) * amt), b: clamp(b + (255 - b) * amt) };
}

function extractPalette({ data }) {
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (l < .12 || l > .92) continue;
    if (s < .18) continue;
    const hsl = rgbToHsl(r, g, b);
    const hueKey = Math.round(hsl[0] / 12) * 12;
    const key = hueKey + "|" + Math.round(hsl[1] * 4) + "|" + Math.round(hsl[2] * 4);
    const cur = buckets.get(key) || { r: 0, g: 0, b: 0, w: 0 };
    const w = 1 + s * 2;
    cur.r += r * w; cur.g += g * w; cur.b += b * w; cur.w += w;
    buckets.set(key, cur);
  }
  const arr = Array.from(buckets.values())
    .map(x => ({ r: x.r / x.w | 0, g: x.g / x.w | 0, b: x.b / x.w | 0, w: x.w }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 8);
  return arr.length ? arr : null;
}

function isMultiHue(palette) {
  if (!palette || palette.length < 2) return false;
  const total = palette.reduce((s, p) => s + p.w, 0);
  const top = palette[0].w / total;
  const strong = palette.filter(p => p.w / total > 0.12);
  const hues = strong.map(p => rgbToHsl(p.r, p.g, p.b)[0]);
  let distinct = 0;
  for (let i = 0; i < hues.length; i++) {
    let unique = true;
    for (let j = 0; j < i; j++) {
      let d = Math.abs(hues[i] - hues[j]);
      if (d > 180) d = 360 - d;
      if (d < 30) { unique = false; break; }
    }
    if (unique) distinct++;
  }
  return top < 0.5 && distinct >= 3;
}

function defaultTheme() {
  const primary = { r: 243, g: 186, b: 47 };
  return { primary: rgbToHex(primary), primary2: rgbToHex(lighten(primary, .25)), onPrimary: "#0c0c10" };
}

/* Fetch the token logo and derive theme colors using the same
   algorithm the browser uses. Returns { primary, primary2, onPrimary,
   imageBytes, imageMime } so the renderer can embed the logo too. */
export async function buildTheme(meta) {
  if (!meta.image) return { ...defaultTheme(), imageBytes: null, imageMime: null };
  try {
    const res = await fetch(proxify(meta.image, 96), {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!res.ok) return { ...defaultTheme(), imageBytes: null, imageMime: null };
    const ct = res.headers.get("content-type") || "";
    const buf = await res.arrayBuffer();
    const decoded = decode(buf, ct);
    const palette = decoded ? extractPalette(decoded) : null;

    let primary, primary2, onPrimary;
    if (palette && palette.length) {
      if (isMultiHue(palette)) {
        primary = { r: 255, g: 255, b: 255 };
        primary2 = { r: 230, g: 230, b: 230 };
        onPrimary = "#000000";
      } else {
        primary = palette[0];
        primary2 = lighten(primary, .25);
        onPrimary = bestTextOn(primary);
      }
    } else {
      const d = defaultTheme();
      return { ...d, imageBytes: buf, imageMime: ct || "image/png" };
    }
    return {
      primary: rgbToHex(primary),
      primary2: rgbToHex(primary2),
      onPrimary,
      imageBytes: buf,
      imageMime: ct || "image/png",
    };
  } catch (_) {
    return { ...defaultTheme(), imageBytes: null, imageMime: null };
  }
}

export function shortCa(ca) { return ca.slice(0, 4) + "…" + ca.slice(-4); }