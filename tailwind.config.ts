/**
 * tailwind.config.ts
 * Extends Tailwind's default palette with the Misfortune Cookie design tokens
 * so you can use classes like bg-midnight, text-neon, border-neon-dim, etc.
 * alongside arbitrary-value classes like bg-[#0A0F1C].
 */
import type { Config } from "tailwindcss";

const config: Config = {
  // Only scan these paths — keeps the CSS bundle lean on Vercel
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#0A0F1C",
        neon:     "#00FF41",
        "neon-dim": "#00BB30",
      },
      fontFamily: {
        mono: ["'Share Tech Mono'", "monospace"],
        display: ["'Major Mono Display'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
