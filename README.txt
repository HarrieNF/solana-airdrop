OG image-only replacement

Copy these files into the root of your site, keeping the same paths:

- functions/og.js
- functions/_lib/theme.js
- package.json

Then redeploy Cloudflare Pages or run locally:

npm install
npx wrangler pages dev . --compatibility-date=2024-09-23

Test:
http://localhost:8788/og?ca=9Cn7or8TVicZYjSUEmgRk4A9XdXFzkBS8vn1ebt6pump

What changed:
- The renderer is now buffered before returning, so render errors become visible text errors instead of a 200 OK empty PNG.
- The unsupported CSS/background rendering that caused 0-byte images was removed.
- The OG card now uses the token logo URL directly through the image proxy, so the icon and colors change automatically by CA.
