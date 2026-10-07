# Planha Local Staging Site

Start the backend Local Staging stack first. Then run:

```bash
npm run staging:local
```

This builds the same production Worker bundle and serves it through Wrangler at
`http://localhost:8787`. Its API routes use `http://127.0.0.1:8080` as the
Planha engine and a fixed local-only bridge token. Local D1 and R2 emulation is
managed by Wrangler; no Cloudflare, Railway, Production, or online Staging
credentials are required.

Stop with `Ctrl-C`. Local Worker state is under the ignored `.wrangler`
directory and may be removed when a clean local data set is needed.
