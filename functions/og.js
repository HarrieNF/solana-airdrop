/* Dynamic Open Graph image generator.
   GET /og?ca=<solana-contract-address>
   Returns a 1200x630 PNG branded for the given token, matching the
   landing page's hero section. */
import { ImageResponse } from "workers-og";
import { fetchMetadata, buildTheme, shortCa } from "./_lib/theme.js";

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const onRequestGet = async ({ request }) => {
  const url = new URL(request.url);
  const ca = (url.searchParams.get("ca") || "").trim();

  if (!ca || !CA_RE.test(ca)) {
    return new Response("Invalid or missing ?ca=", { status: 400 });
  }

  try {
  const meta = await fetchMetadata(ca);
  const theme = await buildTheme(meta);
  // NOTE: do NOT embed the raw logo as a data: URL. satori (inside
  // workers-og) decodes embedded images in the Worker and silently
  // aborts on many real-world PNGs/JPEGs, returning a 0-byte body.
  // The palette already mirrors the logo's brand color, which is the
  // important visual link.
  const logoSrc = null;

  const symbol = (meta.symbol || "TOKEN").toUpperCase();
  const name   = meta.name || "Solana Token";
  const short  = shortCa(ca);
  const desc   = `Join the exclusive airdrop and claim your tokens. Limited-time opportunity for early adopters and community members.`;

  // Hex with alpha helpers
  const primary  = theme.primary;
  const primary2 = theme.primary2;
  const onP      = theme.onPrimary;
  const glow     = primary + "55"; // ~33% alpha glow
  const ringBg   = "#15151c";

  const html = `
    <div style="display:flex;width:1200px;height:630px;background:#0a0a0f;position:relative;font-family:Inter,system-ui,sans-serif;color:#e9eaf0;overflow:hidden;">
      <!-- background grid -->
      <div style="display:flex;position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:54px 54px;"></div>
      <!-- color glow -->
      <div style="display:flex;position:absolute;top:-200px;left:-100px;width:900px;height:900px;background:radial-gradient(circle, ${glow} 0%, transparent 60%);"></div>
      <div style="display:flex;position:absolute;bottom:-300px;right:-200px;width:900px;height:900px;background:radial-gradient(circle, ${glow} 0%, transparent 60%);"></div>

      <!-- top nav strip -->
      <div style="display:flex;position:absolute;top:32px;left:48px;right:48px;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:16px;">
          ${logoSrc
            ? `<img src="${logoSrc}" width="44" height="44" style="border-radius:10px;object-fit:cover;" />`
            : `<div style="display:flex;width:44px;height:44px;border-radius:10px;background:${primary};color:${onP};align-items:center;justify-content:center;font-weight:800;font-size:18px;">${symbol.slice(0, 2)}</div>`}
          <div style="display:flex;font-weight:800;font-size:22px;letter-spacing:.5px;color:#fff;">${symbol}</div>
          <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:14px;color:#cfd2db;">
            <span>${symbol}</span>
            <span style="display:flex;width:6px;height:6px;border-radius:50%;background:${primary};"></span>
            <span style="color:#8b8f9c;">${short}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;padding:12px 22px;border-radius:12px;background:${primary};color:${onP};font-weight:700;font-size:16px;">Claim Tokens</div>
      </div>

      <!-- hero text column -->
      <div style="display:flex;flex-direction:column;position:absolute;top:170px;left:64px;width:620px;">
        <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);align-self:flex-start;font-size:14px;color:#cfd2db;margin-bottom:24px;">
          <span style="display:flex;width:8px;height:8px;border-radius:50%;background:${primary};"></span>
          <span>Live ${symbol} Airdrop</span>
        </div>
        <div style="display:flex;font-size:64px;font-weight:800;line-height:1.05;color:#ffffff;letter-spacing:-1px;">Take part in the</div>
        <div style="display:flex;font-size:64px;font-weight:800;line-height:1.05;letter-spacing:-1px;margin-top:6px;">
          <span style="color:${primary};">$${symbol}</span>
          <span style="color:#ffffff;margin-left:18px;">airdrop</span>
        </div>
        <div style="display:flex;margin-top:26px;font-size:20px;line-height:1.45;color:#9ea2af;max-width:560px;">${desc}</div>
        <div style="display:flex;gap:14px;margin-top:34px;">
          <div style="display:flex;align-items:center;padding:16px 26px;border-radius:12px;background:${primary};color:${onP};font-weight:700;font-size:17px;">Claim $ ${symbol}</div>
          <div style="display:flex;align-items:center;padding:16px 26px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;font-weight:600;font-size:17px;">Learn More</div>
        </div>
      </div>

      <!-- hero image panel -->
      <div style="display:flex;position:absolute;top:120px;right:64px;width:380px;height:380px;border-radius:28px;background:${ringBg};border:1px solid rgba(255,255,255,.06);align-items:center;justify-content:center;box-shadow:0 0 120px ${glow};">
        ${logoSrc
          ? `<img src="${logoSrc}" width="320" height="320" style="border-radius:20px;object-fit:cover;" />`
          : `<div style="display:flex;width:320px;height:320px;border-radius:20px;background:linear-gradient(135deg, ${primary}, ${primary2});color:${onP};font-size:140px;font-weight:800;align-items:center;justify-content:center;">${symbol.slice(0, 1)}</div>`}
      </div>

      <!-- footer name -->
      <div style="display:flex;position:absolute;bottom:34px;left:64px;font-size:14px;color:#6c7080;">${name}</div>
    </div>
  `;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    format: "png",
    headers: {
      // 1h browser cache, 1d edge cache; crawlers refetch when CA changes.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
  } catch (err) {
    // Surface errors in plain text instead of a blank PNG so failures
    // are debuggable from the browser.
    return new Response("OG render failed: " + (err && err.stack || err), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
};