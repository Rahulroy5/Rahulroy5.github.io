# Portfolio AI Assistant

The `ask` command in the [portfolio terminal](https://rahulroy5.github.io/#playground)
is backed by Gemini, proxied through a Cloudflare Worker so the API key never
touches the browser.

```
visitor's browser ──POST──▶ Cloudflare Worker ──▶ Gemini API
                            (holds the key,
                             injects the bio
                             as system prompt)
```

Why a proxy at all? Client-side JavaScript is public — any key shipped to the
browser can be extracted from DevTools in seconds. The Worker keeps the key in an
encrypted secret, pins CORS to this site's origin, validates every request, and
caps output tokens.

## Deploy (one-time, ~15 min, $0)

1. **Gemini key** — [aistudio.google.com](https://aistudio.google.com) → *Get API key*
   → create key. Free tier is enough for a portfolio.
2. **Worker** — [dash.cloudflare.com](https://dash.cloudflare.com) (free account) →
   *Workers & Pages* → *Create Worker* → name it `rahul-assistant` → *Edit code* →
   paste [`worker.js`](./worker.js) → *Deploy*.
3. **Secret** — Worker → *Settings* → *Variables and Secrets* → add
   `GEMINI_API_KEY` with type **Secret** → paste the key from step 1.
4. **Wire the site** — copy the Worker URL (`https://rahul-assistant.<subdomain>.workers.dev`)
   into `ASSISTANT_URL` in `index.html`.

## Abuse limits

The endpoint is public (anyone can POST to it), so the Worker enforces:
origin allow-list, ≤ 8 messages of ≤ 600 chars, and `maxOutputTokens` cap.
Gemini's free tier adds its own daily quota — if it's exhausted, the terminal
falls back to a "come back later" message rather than breaking.
