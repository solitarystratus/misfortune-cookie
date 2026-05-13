# 🥠 Misfortune Cookie

> *Let the cosmos tell you what's wrong with you.*

An in-browser AI roast engine. Runs a 1B-parameter LLM **entirely in your browser** via WebGPU — no server, no API key, no data ever leaves your device.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Styling | Tailwind CSS + inline styles |
| Animation | framer-motion |
| AI Engine | @mlc-ai/web-llm (WebGPU) |
| Screenshot | html2canvas |
| Model | Llama-3.2-1B-Instruct-q4f32_1-MLC |

---

## Installation

```bash
# 1. Create a new Next.js project (skip if you have one)
npx create-next-app@latest misfortune-cookie --typescript --tailwind --app --no-src-dir --no-import-alias

cd misfortune-cookie

# 2. Install the required packages
npm install framer-motion @mlc-ai/web-llm html2canvas
```

Then **replace** the generated files with the files from this repository:
- `app/page.tsx`   → the main component
- `app/layout.tsx` → root layout (no-flash background)
- `app/globals.css` → Tailwind directives
- `next.config.js` → WebAssembly + CORP/COOP headers (required!)
- `tailwind.config.ts` → custom color tokens

---

## Running Locally

```bash
npm run dev
# → http://localhost:3000
```

> **Note:** The first run downloads the model (~700 MB). It is cached in the
> browser's Cache API afterwards — subsequent loads are fast.

---

## Deploy to Vercel

```bash
# One-liner deploy
npx vercel --prod
```

The `next.config.js` already sets the necessary `Cross-Origin-Opener-Policy`
and `Cross-Origin-Embedder-Policy` headers that WebGPU/SharedArrayBuffer
requires. Vercel serves these automatically.

---

## Browser Requirements

WebGPU is **not universally supported yet**. Required:

| Browser | Min Version | Notes |
|---|---|---|
| Chrome | 113+ | Best support |
| Edge | 113+ | Chromium-based, same support |
| Firefox | Nightly | Behind a flag |
| Safari | 18+ | Partial support |
| Mobile | ❌ | Generally not supported yet |

The app shows a graceful fallback screen with instructions if WebGPU is absent.

---

## File Structure

```
misfortune-cookie/
├── app/
│   ├── page.tsx       ← The entire app lives here
│   ├── layout.tsx     ← Root layout (no-flash background)
│   └── globals.css    ← Tailwind directives
├── next.config.js     ← WASM + security headers (REQUIRED)
└── tailwind.config.ts ← Design tokens
```

---

## How It Works

1. **Load** — `@mlc-ai/web-llm` downloads and caches the Llama 3.2 1B model in your browser's Cache API, running inference via WebGPU.
2. **Input** — User enters Name, Age, and City.
3. **Drop** — A fortune cookie SVG drops in with a jello spring animation (framer-motion).
4. **Crack** — Dragging/tapping the cookie triggers: screen shake (CSS keyframe) + the two cookie halves flying apart.
5. **Generate** — The inputs are passed to the local LLM with a cynical Reddit-roaster system prompt.
6. **Result** — The fortune fades in on a shareable card. `html2canvas` screenshots the card as a PNG for sharing.

---

*Powered by WebGPU. Judged locally. No cloud. No mercy.*
