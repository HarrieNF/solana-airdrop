# Solana Airdrop — Dynamic OG Preview

Your existing dynamically-branded Solana token airdrop site, now with a
production-ready **Open Graph preview image generator** that runs on
Cloudflare Pages Functions.

When anyone shares a URL like:

```
https://your-domain.com/landing.html?ca=<CONTRACT_ADDRESS>
```

Telegram, Discord, Twitter/X, Facebook, and WhatsApp all show a 1200×630
PNG preview that looks like the hero section of your landing page —
**branded for that specific token** (logo, name, symbol, colors,
button contrast). The colors come from the *same* palette-extraction
algorithm the landing page uses, so the preview and the page always
match.

Nothing is hardcoded to a domain. The same code works on `localhost`,
`*.pages.dev`, and any custom domain.

---

## What's in the project

```
.
├── index.html              # CA gate page (your original)
├── landing.html            # Dynamic branded landing page (your original)
├── style.css               # Theme (CSS vars, overridden at runtime)
├── script.js               # Runtime branding engine (your original)
├── config.js               # Providers + fallbacks
├── manifest.json
├── robots.txt
├── sitemap.xml
├── package.json            # Declares Pages Function deps
├── functions/
│   ├── og.js               # GET /og?ca=...  -> 1200x630 PNG
│   ├── _middleware.js      # Rewrites og:* meta tags with absolute URLs
│   └── _lib/
│       └── theme.js        # Server mirror of script.js palette logic
└── README.md
```

The landing page and the OG image share the **same** theme logic
(`functions/_lib/theme.js` mirrors `script.js`), so brand colors stay
synchronized.

---

## Local development

```bash
npm install
npx wrangler pages dev . --compatibility-date=2024-09-23
# open http://localhost:8788/landing.html?ca=<address>
# preview the OG image:  http://localhost:8788/og?ca=<address>
```

No build step is required.

---

## Deploy via GitHub + Cloudflare Pages

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Solana airdrop with dynamic OG"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 2. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick your repo. On the build configuration screen:

| Setting                | Value                          |
| ---------------------- | ------------------------------ |
| Framework preset       | **None**                       |
| Build command          | *(leave blank)*                |
| Build output directory | `/` *(project root)*           |
| Root directory         | *(leave blank / default)*      |
| Functions directory    | `functions` *(auto-detected)*  |
| Node.js version        | `20` *(default is fine)*       |

3. Click **Save and deploy**. No environment variables are required.

Cloudflare Pages will:
- Serve the static HTML/CSS/JS straight from the project root.
- Bundle `functions/og.js` and `functions/_middleware.js` (and their npm
  deps from `package.json`) into Pages Functions automatically.

### 3. Test

After deploy:

- Landing page:
  `https://<your-project>.pages.dev/landing.html?ca=<CA>`
- Raw OG image:
  `https://<your-project>.pages.dev/og?ca=<CA>`
- Check the share preview with Twitter's
  [Card Validator](https://cards-dev.twitter.com/validator) or
  Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/).

Try different tokens to see colors / logo / symbol change:

```
/landing.html?ca=EhHy...pump      → red theme + red OG preview
/landing.html?ca=Tqj8...pump      → blue theme + blue OG preview
```

---

## How it works

1. A crawler requests `/landing.html?ca=<CA>`.
2. `functions/_middleware.js` intercepts the response, fetches the
   token's metadata (Jupiter → Dexscreener fallback), and uses
   Cloudflare's built-in `HTMLRewriter` to replace `<title>`,
   `og:title`, `og:description`, `og:image`, `og:url`, `twitter:*`,
   and `<link rel="canonical">` with values built from the current
   request URL — **no hardcoded host**.
3. `og:image` points at `/og?ca=<CA>` on the same origin.
4. The crawler then fetches `/og?ca=<CA>`, which:
   - Looks up the token's metadata.
   - Downloads the logo through `images.weserv.nl` (small, CORS-safe).
   - Decodes the pixels in pure JS (`upng-js` / `jpeg-js`).
   - Runs the **same** dominant-color + multi-hue palette logic the
     browser does in `script.js`, picks a readable button text color,
     and renders a 1200×630 PNG via [`workers-og`](https://workers-og.pages.dev/)
     (Satori + resvg, bundled and Pages-compatible — no manual WASM
     wiring, no `CompiledWasm` rules).
5. Browsers still get the original `script.js` running client-side,
   which re-applies the same theme — so the visible page and the
   shared preview look identical.

---

## Notes

- The OG image is cached at the edge for 24h per CA. To force a refresh,
  hit `/og?ca=<CA>&v=2` (any extra query param works) or purge the
  Cloudflare cache.
- Social platforms also cache previews aggressively — use their
  validator tools to force a refetch when iterating on the design.
- Don't put real RPC keys in `config.js`; it ships to browsers. Use a
  proxy if you need authenticated RPC traffic.