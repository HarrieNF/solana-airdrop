/* =============================================================
   Dynamic Solana Airdrop — runtime branding engine.
   Flow:
     1) read CA  ->  2) validate  ->  3) fetch metadata
     4) load image  ->  5) extract palette  ->  6) build theme
     7) swap logos + favicon  ->  8) reveal UI
   ============================================================= */
(function(){
  "use strict";
  const CFG = window.AIRDROP_CONFIG;
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- 1) Read CA from URL ----------
  const url = new URL(location.href);
  let ca = url.searchParams.get("ca") || (location.hash || "").replace(/^#/,"");
  if (!ca || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca.trim())) {
    location.replace("index.html");
    return;
  }
  ca = ca.trim();

  // ---------- Loader helpers ----------
  const loader = $("#loader");
  const loaderText = $("#loader-text");
  const loaderBar = $("#loader-bar-fill");
  const startedAt = performance.now();
  let progress = 0;
  function setStep(label, pct){
    loaderText.textContent = label;
    progress = Math.max(progress, pct);
    loaderBar.style.width = progress + "%";
  }

  // ---------- 3) Fetch metadata ----------
  async function fetchMetadata(addr){
    for (const p of CFG.metadataProviders){
      try {
        const res = await fetch(p.url.replace("{ca}", addr), { headers: { accept:"application/json" } });
        if (!res.ok) continue;
        const data = await res.json();
        const m = normalizeMetadata(p.name, data);
        if (m && (m.image || m.name)) return m;
      } catch(_) { /* try next */ }
    }
    return { name: CFG.fallback.name, symbol: CFG.fallback.symbol, image: CFG.fallback.image, links: {} };
  }

  function normalizeMetadata(provider, data){
    if (provider === "jupiter" && data && data.address){
      return {
        name: data.name || CFG.fallback.name,
        symbol: data.symbol || CFG.fallback.symbol,
        image: data.logoURI || "",
        decimals: data.decimals,
        links: extractLinks(data.extensions || {})
      };
    }
    if (provider === "dexscreener" && data && Array.isArray(data.pairs) && data.pairs.length){
      const pair = data.pairs[0];
      const base = pair.baseToken || {};
      const info = pair.info || {};
      const image = (info.imageUrl) || `https://dd.dexscreener.com/ds-data/tokens/solana/${base.address}.png`;
      return {
        name: base.name || CFG.fallback.name,
        symbol: base.symbol || CFG.fallback.symbol,
        image,
        links: extractDexLinks(info)
      };
    }
    return null;
  }

  function extractLinks(ext){
    const out = {};
    if (ext.twitter) out.twitter = "https://twitter.com/" + String(ext.twitter).replace(/^@/,'');
    if (ext.telegram) out.telegram = ext.telegram.startsWith("http") ? ext.telegram : "https://t.me/" + ext.telegram;
    if (ext.discord) out.discord = ext.discord;
    if (ext.website) out.website = ext.website;
    return out;
  }
  function extractDexLinks(info){
    const out = {};
    (info.socials || []).forEach(s => { if (s.type && s.url) out[s.type.toLowerCase()] = s.url; });
    (info.websites || []).forEach(w => { if (!out.website) out.website = w.url; });
    return out;
  }

  // ---------- 4) Load image ----------
  // Many Solana token icon hosts (Arweave, IPFS gateways, Dexscreener CDN)
  // do NOT return CORS headers. With crossOrigin="anonymous" the image
  // fails to load entirely, so palette extraction never runs and the theme
  // falls back to default yellow. We retry through a public CORS proxy
  // (images.weserv.nl) so the canvas can read pixels for color extraction.
  function proxify(url){
    if (!url || url.startsWith("data:")) return url;
    const stripped = url.replace(/^https?:\/\//, "");
    return "https://images.weserv.nl/?url=" + encodeURIComponent(stripped) + "&n=-1";
  }
  function tryLoad(src, withCors){
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (withCors) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("img load failed: " + src));
      img.src = src;
    });
  }
  function loadImage(src){
    if (!src) return Promise.reject(new Error("no image"));
    // Try direct with CORS first (works for hosts that send ACAO).
    return tryLoad(src, true).catch(() =>
      // Fallback: route through CORS-enabled proxy so canvas isn't tainted.
      tryLoad(proxify(src), true)
    );
  }

  // ---------- 5) Palette extraction ----------
  function extractPalette(img){
    const c = document.createElement("canvas");
    const size = 64;
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    let data;
    try { data = ctx.getImageData(0, 0, size, size).data; }
    catch(e){ return null; } // CORS-tainted

    // Bucket by quantized HSL hue; weight by saturation.
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4){
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a < 200) continue;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const l = (max + min) / 510;
      const s = max === min ? 0 : (max - min) / (255 - Math.abs(max+min-255));
      if (l < .12 || l > .92) continue;     // skip near-black / near-white
      if (s < .18) continue;                // skip grays
      const hsl = rgbToHsl(r,g,b);
      const hueKey = Math.round(hsl[0] / 12) * 12;   // 30 buckets
      const key = hueKey + "|" + Math.round(hsl[1]*4) + "|" + Math.round(hsl[2]*4);
      const cur = buckets.get(key) || { r:0,g:0,b:0,w:0 };
      const w = 1 + s * 2;
      cur.r += r*w; cur.g += g*w; cur.b += b*w; cur.w += w;
      buckets.set(key, cur);
    }
    const arr = Array.from(buckets.values())
      .map(x => ({ r: x.r/x.w|0, g: x.g/x.w|0, b: x.b/x.w|0, w: x.w }))
      .sort((a,b) => b.w - a.w)
      .slice(0, 8);
    return arr.length ? arr : null;
  }

  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h=0,s=0,l=(max+min)/2;
    if (max!==min){
      const d=max-min;
      s = l > .5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h=(g-b)/d + (g<b?6:0); break;
        case g: h=(b-r)/d + 2; break;
        case b: h=(r-g)/d + 4; break;
      }
      h*=60;
    }
    return [h,s,l];
  }
  function rgbToHex({r,g,b}){ return "#" + [r,g,b].map(v=>v.toString(16).padStart(2,"0")).join(""); }
  function luminance({r,g,b}){
    const lin = v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
    return .2126*lin(r) + .7152*lin(g) + .0722*lin(b);
  }
  function bestTextOn(rgb){ return luminance(rgb) > .45 ? "#0c0c10" : "#ffffff"; }
  function lighten({r,g,b}, amt){
    return { r: clamp(r + (255-r)*amt), g: clamp(g + (255-g)*amt), b: clamp(b + (255-b)*amt) };
  }
  function clamp(v){ return Math.max(0, Math.min(255, v|0)); }

  // ---------- 6) Apply theme ----------
  // Pick a button color that *reads* well: if the logo has one dominant hue
  // (e.g. HEISTED red), use it with auto-contrast text. If the logo is
  // multi-colored / rainbow with no clear dominant hue (e.g. WEN), fall back
  // to a clean white button with black text so the CTA stays legible.
  function isMultiHue(palette){
    if (!palette || palette.length < 2) return false;
    const total = palette.reduce((s,p)=>s+p.w, 0);
    const top = palette[0].w / total;
    // Count distinct hues with meaningful weight
    const strong = palette.filter(p => p.w / total > 0.12);
    const hues = strong.map(p => rgbToHsl(p.r,p.g,p.b)[0]);
    let distinct = 0;
    for (let i = 0; i < hues.length; i++){
      let unique = true;
      for (let j = 0; j < i; j++){
        let d = Math.abs(hues[i] - hues[j]);
        if (d > 180) d = 360 - d;
        if (d < 30) { unique = false; break; }
      }
      if (unique) distinct++;
    }
    // Rainbow / no clear dominant color
    return top < 0.5 && distinct >= 3;
  }

  function applyTheme(palette){
    const root = document.documentElement.style;
    let primary, primary2, onPrimary;
    if (palette && palette.length){
      if (isMultiHue(palette)){
        // Neutral white CTA for multi-color logos
        primary = { r:255, g:255, b:255 };
        primary2 = { r:230, g:230, b:230 };
        onPrimary = "#000000";
      } else {
        primary = palette[0];
        primary2 = lighten(primary, .25);
        onPrimary = bestTextOn(primary);
      }
    } else {
      primary = { r:243,g:186,b:47 };
      primary2 = lighten(primary, .25);
      onPrimary = "#0c0c10";
    }
    root.setProperty("--primary", rgbToHex(primary));
    root.setProperty("--primary-2", rgbToHex(primary2));
    root.setProperty("--accent", rgbToHex(primary));
    root.setProperty("--on-primary", onPrimary);
    $("#meta-theme").setAttribute("content", rgbToHex(primary));
  }

  // ---------- 7) Apply branding (logo, text, favicon, meta) ----------
  function applyBranding(meta, imageDataUrl){
    // Text bindings
    $$("[data-bind='symbol']").forEach(el => el.textContent = meta.symbol);
    document.title = `$${meta.symbol} Airdrop — Claim your tokens`;
    const desc = `Claim your share of the live $${meta.symbol} (${meta.name}) airdrop on Solana.`;
    $("#meta-desc").setAttribute("content", desc);
    $("#og-title").setAttribute("content", `$${meta.symbol} Airdrop`);
    $("#og-desc").setAttribute("content", desc);
    $("#tw-title").setAttribute("content", `$${meta.symbol} Airdrop`);
    $("#tw-desc").setAttribute("content", desc);
    $("#canonical").setAttribute("href", location.href);

    // Social/link preview image: crawlers (Twitter/Discord/FB) reject data:
    // URLs, so always point og:image / twitter:image at an absolute remote
    // URL. Prefer the token's hosted logo; if it lacks CORS for crawlers,
    // route through the image proxy which serves with proper headers.
    const shareImg = meta.image ? proxify(meta.image) : "";
    if (shareImg){
      $("#og-image").setAttribute("content", shareImg);
      $("#tw-image").setAttribute("content", shareImg);
    }
    // Short CA in pill
    $("#ca-short").textContent = ca.slice(0,4) + "…" + ca.slice(-4);

    // Logos — hero, navbar, footer, eligibility art all share .logo-img.
    // Use the remote URL for <img> display (no CORS needed to *render*),
    // and fall back to the proxied URL on error so every preview/hero/
    // eligibility image stays dynamic with the token's branding.
    const primarySrc = meta.image || imageDataUrl || "";
    const fallbackSrc = meta.image ? proxify(meta.image) : (imageDataUrl || "");
    if (primarySrc){
      $$(".logo-img").forEach(img => {
        if (img.tagName !== "IMG") return;
        img.alt = meta.name + " logo";
        img.onerror = () => {
          img.onerror = () => img.replaceWith(makeFallbackLogo(meta.symbol));
          if (fallbackSrc && img.src !== fallbackSrc) img.src = fallbackSrc;
          else if (imageDataUrl && img.src !== imageDataUrl) img.src = imageDataUrl;
        };
        img.src = primarySrc;
      });
    } else {
      $$(".logo-img").forEach(img => img.replaceWith(makeFallbackLogo(meta.symbol)));
    }

    // Favicon (canvas-rendered from logo or fallback initial)
    buildFavicon(imageDataUrl, meta.symbol).then(href => {
      $("#favicon").setAttribute("href", href);
      $("#apple-icon").setAttribute("href", href);
    });

    // Social links
    const links = meta.links || {};
    [["#link-twitter", links.twitter], ["#link-telegram", links.telegram], ["#link-discord", links.discord],
     ["#f-twitter", links.twitter], ["#f-telegram", links.telegram], ["#f-discord", links.discord]
    ].forEach(([sel, href]) => { const el = $(sel); if (el && href) el.href = href; });
  }

  function makeFallbackLogo(symbol){
    const div = document.createElement("div");
    div.className = "logo-img";
    div.style.cssText = "display:grid;place-items:center;font-weight:800;color:var(--on-primary);background:var(--primary)";
    div.textContent = (symbol || "?").slice(0,2);
    return div;
  }

  function buildFavicon(src, symbol){
    return new Promise(resolve => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      // rounded background
      ctx.fillStyle = "#111";
      roundedRect(ctx, 0, 0, size, size, 14); ctx.fill();
      const finish = () => resolve(c.toDataURL("image/png"));
      if (src){
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.save();
          roundedRect(ctx, 4, 4, size-8, size-8, 12); ctx.clip();
          ctx.drawImage(img, 4, 4, size-8, size-8);
          ctx.restore();
          finish();
        };
        img.onerror = () => { drawLetter(); finish(); };
        img.src = src;
      } else {
        drawLetter(); finish();
      }
      function drawLetter(){
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#f3ba2f";
        roundedRect(ctx, 4, 4, size-8, size-8, 12); ctx.fill();
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--on-primary").trim() || "#111";
        ctx.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((symbol || "?").slice(0,2), size/2, size/2 + 2);
      }
    });
  }
  function roundedRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }

  // ---------- UI extras ----------
  function spawnParticles(n){
    const host = $("#particles"); if (!host) return;
    for (let i=0;i<n;i++){
      const s = document.createElement("span");
      const dur = 8 + Math.random()*14;
      s.style.left = (Math.random()*100) + "%";
      s.style.animationDuration = dur + "s";
      s.style.animationDelay = (-Math.random()*dur) + "s";
      s.style.opacity = (.2 + Math.random()*.5).toFixed(2);
      host.appendChild(s);
    }
  }
  function wireReveals(){
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: .12 });
    $$(".reveal, .section, .card").forEach(el => { el.classList.add("reveal"); io.observe(el); });
  }
  function wireBackTop(){
    const btn = $("#back-top");
    addEventListener("scroll", () => btn.classList.toggle("show", scrollY > 600), { passive:true });
    btn.addEventListener("click", () => scrollTo({ top:0, behavior:"smooth" }));
  }
  function wireConnect(){
    const btn = $("#connect-btn"); if (!btn) return;
    btn.addEventListener("click", async () => {
      const p = window.solana;
      if (p && p.isPhantom){
        try { const r = await p.connect(); btn.textContent = r.publicKey.toString().slice(0,4)+"…"+r.publicKey.toString().slice(-4); }
        catch(_){ /* user rejected */ }
      } else {
        window.open("https://phantom.app/", "_blank", "noopener");
      }
    });
  }

  // ---------- Main ----------
  async function main(){
    setStep("Loading Token…", 8);
    spawnParticles(CFG.ui.particleCount);

    setStep("Fetching Metadata…", 25);
    const meta = await fetchMetadata(ca);

    let img = null, dataUrl = null, palette = null;
    if (meta.image){
      setStep("Downloading Branding…", 45);
      try { img = await loadImage(meta.image); } catch(_) {}
      if (img){
        setStep("Generating Theme…", 65);
        palette = extractPalette(img);
        // Convert to data URL when CORS allows; otherwise keep remote URL.
        if (palette){
          try {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext("2d").drawImage(img, 0, 0);
            dataUrl = c.toDataURL("image/png");
          } catch(_) { dataUrl = null; }
        }
      }
    }

    applyTheme(palette);
    setStep("Preparing Airdrop…", 85);
    applyBranding(meta, dataUrl || meta.image || "");

    // small min delay so flash doesn't feel jarring
    const wait = Math.max(0, CFG.ui.minLoaderMs - (performance.now() - startedAt));
    setTimeout(() => {
      setStep("Ready", 100);
      requestAnimationFrame(() => {
        document.body.dataset.state = "ready";
        loader.classList.add("hide");
        $("#app").setAttribute("aria-hidden","false");
        wireReveals(); wireBackTop(); wireConnect();
        $("#year").textContent = new Date().getFullYear();
      });
    }, wait);
  }

  main().catch(err => {
    console.error(err);
    setStep("Something went wrong…", 100);
  });
})();
