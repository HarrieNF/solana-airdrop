/* Dynamic Open Graph image generator.
   GET /og?ca=<solana-contract-address>
   Returns a 1200x630 PNG branded for the given token, matching the
   landing page hero section. */
import { ImageResponse } from "workers-og";
import { fetchMetadata, buildTheme, shortCa, proxify } from "./_lib/theme.js";

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const OG_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Black.ttf";

async function loadFont() {
  try {
    const cache = caches.default;
    const cached = await cache.match(OG_FONT_URL);
    if (cached) return await cached.arrayBuffer();
    const res = await fetch(OG_FONT_URL, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!res.ok) return null;
    const stored = new Response(res.body, res);
    stored.headers.set("Cache-Control", "public, max-age=86400");
    await cache.put(OG_FONT_URL, stored.clone());
    return await stored.arrayBuffer();
  } catch (_) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alpha(hex, aa) {
  return `${hex}${aa}`;
}

function fitSymbol(symbol) {
  const clean = String(symbol || "TOKEN").toUpperCase();
  return clean.length > 12 ? `${clean.slice(0, 10)}…` : clean;
}

export const onRequestGet = async ({ request }) => {
  const url = new URL(request.url);
  const ca = (url.searchParams.get("ca") || "").trim();

  if (!ca || !CA_RE.test(ca)) {
    return new Response("Invalid or missing ?ca=", { status: 400 });
  }

  try {
    const meta = await fetchMetadata(ca);
    const theme = await buildTheme(meta);

    const rawSymbol = meta.symbol || "TOKEN";
    const symbol = fitSymbol(rawSymbol);
    const name = meta.name || "Solana Token";
    const short = shortCa(ca);
    const primary = theme.primary;
    const primary2 = theme.primary2;
    const onPrimary = theme.onPrimary;
    const logoSrc = meta.image ? proxify(meta.image, 420) : "";
    const iconText = escapeHtml(String(rawSymbol || "T").slice(0, 2).toUpperCase());

    const verticals = Array.from({ length: 23 }, (_, i) =>
      `<div style="display:flex;position:absolute;left:${i * 54}px;top:0;width:1px;height:630px;background:rgba(255,255,255,0.035);"></div>`,
    ).join("");
    const horizontals = Array.from({ length: 13 }, (_, i) =>
      `<div style="display:flex;position:absolute;left:0;top:${i * 54}px;width:1200px;height:1px;background:rgba(255,255,255,0.035);"></div>`,
    ).join("");

    const html = `
      <div style="display:flex;width:1200px;height:630px;background:#090a10;position:relative;font-family:OgFont,Arial,Helvetica,sans-serif;color:#f4f5f8;overflow:hidden;">
        <div style="display:flex;position:absolute;inset:0;background:#090a10;"></div>
        <div style="display:flex;position:absolute;inset:0;opacity:1;">${verticals}${horizontals}</div>
        <div style="display:flex;position:absolute;top:-140px;right:120px;width:520px;height:520px;border-radius:260px;background:${alpha(primary, "26")};filter:blur(34px);"></div>
        <div style="display:flex;position:absolute;bottom:-220px;left:-80px;width:560px;height:560px;border-radius:280px;background:${alpha(primary, "20")};filter:blur(38px);"></div>
        <div style="display:flex;position:absolute;top:0;left:0;right:0;height:72px;background:rgba(22,23,32,0.82);border-bottom:1px solid rgba(255,255,255,0.06);"></div>

        <div style="display:flex;position:absolute;top:14px;left:82px;right:82px;height:44px;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:14px;">
            ${logoSrc
              ? `<img src="${escapeHtml(logoSrc)}" width="34" height="34" style="border-radius:8px;object-fit:cover;" />`
              : `<div style="display:flex;width:34px;height:34px;border-radius:8px;background:${primary};color:${onPrimary};align-items:center;justify-content:center;font-weight:900;font-size:14px;">${iconText}</div>`}
            <div style="display:flex;font-weight:900;font-size:22px;color:#ffffff;">${escapeHtml(symbol)}</div>
            <div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-radius:9px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.08);color:#d5d7de;font-size:12px;font-weight:700;">
              <span>${escapeHtml(symbol)}</span>
              <span style="display:flex;width:5px;height:5px;border-radius:5px;background:${primary};"></span>
              <span style="color:#8f94a3;">${escapeHtml(short)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="display:flex;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.08);align-items:center;justify-content:center;color:#d8d9df;font-weight:900;font-size:15px;">X</div>
            <div style="display:flex;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.08);align-items:center;justify-content:center;color:#d8d9df;font-weight:900;font-size:16px;">TG</div>
            <div style="display:flex;width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.08);align-items:center;justify-content:center;color:#d8d9df;font-weight:900;font-size:14px;">D</div>
            <div style="display:flex;align-items:center;justify-content:center;height:42px;padding:0 25px;border-radius:10px;background:${primary};color:${onPrimary};font-weight:900;font-size:15px;">Claim Tokens</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;position:absolute;left:84px;top:135px;width:620px;">
          <div style="display:flex;align-items:center;gap:9px;align-self:flex-start;padding:8px 15px;border-radius:999px;background:${alpha(primary, "1f")};border:1px solid ${alpha(primary, "44")};color:${primary};font-size:13px;font-weight:800;margin-bottom:25px;white-space:nowrap;">
            <span style="display:flex;width:7px;height:7px;border-radius:7px;background:${primary};"></span>
            <span>Live ${escapeHtml(symbol)} Airdrop</span>
          </div>
          <div style="display:flex;font-size:56px;font-weight:900;line-height:1.06;color:#ffffff;letter-spacing:0;">Take part in the</div>
          <div style="display:flex;font-size:56px;font-weight:900;line-height:1.06;color:#ffffff;letter-spacing:0;">
            <span style="color:${primary};">$${escapeHtml(symbol)}</span><span style="margin-left:14px;">airdrop</span>
          </div>
          <div style="display:flex;margin-top:23px;width:560px;font-size:17px;line-height:1.45;color:#c0c3cc;font-weight:500;">
            Join the exclusive airdrop and claim your tokens. Limited-time opportunity for early adopters and community members. Don't miss out on our revolutionary DeFi project.
          </div>
          <div style="display:flex;gap:16px;margin-top:30px;">
            <div style="display:flex;align-items:center;justify-content:center;height:50px;padding:0 25px;border-radius:10px;background:${primary};color:${onPrimary};font-weight:900;font-size:15px;box-shadow:0 0 34px ${alpha(primary, "66")};">Claim $${escapeHtml(symbol)}</div>
            <div style="display:flex;align-items:center;justify-content:center;height:50px;padding:0 25px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.11);color:#ffffff;font-weight:800;font-size:15px;">Learn More</div>
          </div>
        </div>

        <div style="display:flex;position:absolute;right:82px;top:115px;width:350px;height:350px;border-radius:28px;background:${primary};box-shadow:0 0 72px ${alpha(primary, "77")};align-items:center;justify-content:center;overflow:hidden;">
          ${logoSrc
            ? `<img src="${escapeHtml(logoSrc)}" width="350" height="350" style="object-fit:cover;" />`
            : `<div style="display:flex;width:350px;height:350px;background:${primary};color:${onPrimary};font-size:116px;font-weight:900;align-items:center;justify-content:center;">${iconText}</div>`}
        </div>
      </div>
    `;

    // Buffer the renderer output before returning it. This prevents hidden
    // stream errors from becoming a misleading 200 OK with a 0-byte PNG.
    const fontData = await loadFont();
    const rendered = new ImageResponse(html, {
      width: 1200,
      height: 630,
      format: "png",
      ...(fontData
        ? {
            fonts: [
              { name: "OgFont", data: fontData, weight: 400, style: "normal" },
              { name: "OgFont", data: fontData, weight: 700, style: "normal" },
              { name: "OgFont", data: fontData, weight: 900, style: "normal" },
            ],
          }
        : {}),
    });
    const png = await rendered.arrayBuffer();

    if (!png.byteLength) {
      throw new Error("Renderer produced an empty PNG body");
    }

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    return new Response(`OG render failed:\n${err?.stack || err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};
