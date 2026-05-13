"use client";

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           MISFORTUNE COOKIE — app/page.tsx               ║
 * ║  In-browser AI roast engine powered by WebLLM + WebGPU   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * TECH STACK:
 *  - Next.js 14+ (App Router, "use client")
 *  - Tailwind CSS (layout/spacing utilities only; custom colors via inline styles)
 *  - framer-motion (cookie drop, crack, transitions, screen shake)
 *  - @mlc-ai/web-llm  (runs Llama-3.2-1B fully in-browser via WebGPU)
 *  - html2canvas (screenshot the result card for sharing)
 *
 * STATE MACHINE:
 *  loading → input → dropping → waiting-crack → cracking → generating → result
 *  (also: unsupported — when WebGPU is absent)
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
} from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

/** WebLLM model ID — smallest/fastest available chat model as of mid-2025 */
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

/**
 * System prompt fed to the LLM before user inputs.
 * Defines the cynical Reddit roaster persona.
 */
const SYSTEM_PROMPT =
  "You are a cynical, highly observant Reddit user. The user will provide their Name, Age, and City. " +
  "Write a 2-sentence roast. Capture that sarcastic 'you think you're the main character' energy. " +
  "Make specific assumptions based on their age and city. No emojis.";

/** Design color tokens for the lo-fi midnight aesthetic */
const C = {
  bg: "#0A0F1C",           // Deep midnight blue
  green: "#00FF41",        // Electric neon green
  greenDim: "#00BB30",     // Dimmed green for secondary text
  greenGlow: "rgba(0,255,65,0.28)",  // Glow bloom for shadows/glows
  surface: "rgba(0,255,65,0.04)",    // Very subtle green-tinted surface
  border: "rgba(0,255,65,0.18)",     // Subtle border
  text: "#D4F0DA",                   // Soft off-white for fortune text
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/** All possible UI states in the app's linear flow */
type AppState =
  | "loading"         // WebLLM engine is downloading / initialising
  | "unsupported"     // WebGPU not available in this browser
  | "input"           // User fills in Name / Age / Location form
  | "dropping"        // Cookie animates into frame (spring drop)
  | "waiting-crack"   // Cookie settled; waiting for user to drag/tap
  | "cracking"        // Crack animation playing + screen shake
  | "generating"      // LLM is producing the fortune text
  | "result";         // Fortune displayed; share / retry options

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GrainOverlay
 * Fixed full-screen CSS noise texture. pointer-events: none so it never
 * intercepts clicks. Uses an inline SVG feTurbulence filter baked into a
 * data-URI background-image for zero network requests.
 */
function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "180px 180px",
      }}
    />
  );
}

/**
 * ScanlineOverlay
 * Subtle horizontal scanline pattern layered above the background,
 * giving the CRT / lo-fi terminal feel.
 */
function ScanlineOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        pointerEvents: "none",
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0,0,0,0.07) 2px,
          rgba(0,0,0,0.07) 4px
        )`,
      }}
    />
  );
}

/**
 * CookieWhole
 * SVG fortune cookie viewed from the front: two petal/wing shapes meeting
 * at a center pinch point, with a paper fortune tab visible in the fold.
 * Uses SVG filter for the neon green glow bloom.
 */
function CookieWhole() {
  return (
    <svg
      viewBox="0 0 160 120"
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="150"
      aria-label="Fortune cookie"
      style={{ filter: `drop-shadow(0 0 14px ${C.green}) drop-shadow(0 0 28px rgba(0,255,65,0.4))` }}
    >
      <defs>
        {/* Inner glow filter applied to cookie paths */}
        <filter id="cg" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left wing — curves left from center pinch */}
      <path
        d="M80,60 C62,22 10,24 8,60 C8,92 56,98 80,60 Z"
        fill="rgba(0,255,65,0.07)"
        stroke={C.green}
        strokeWidth="2.2"
        strokeLinejoin="round"
        filter="url(#cg)"
      />
      {/* Right wing — mirror of left */}
      <path
        d="M80,60 C98,22 150,24 152,60 C152,92 104,98 80,60 Z"
        fill="rgba(0,255,65,0.07)"
        stroke={C.green}
        strokeWidth="2.2"
        strokeLinejoin="round"
        filter="url(#cg)"
      />
      {/* Centre fold crease — dashed vertical line at pinch */}
      <path
        d="M80,24 C76,42 76,60 80,96"
        fill="none"
        stroke={C.greenDim}
        strokeWidth="1.2"
        strokeDasharray="3.5 3"
        opacity="0.7"
      />
      {/* Paper fortune tab peeking from the fold */}
      <rect
        x="66"
        y="52"
        width="28"
        height="14"
        rx="2"
        fill={C.bg}
        stroke={C.greenDim}
        strokeWidth="1"
      />
      {/* Tiny illegible text lines on the paper slip */}
      <line x1="69" y1="57" x2="91" y2="57" stroke={C.greenDim} strokeWidth="0.8" opacity="0.8" />
      <line x1="69" y1="61" x2="87" y2="61" stroke={C.greenDim} strokeWidth="0.8" opacity="0.8" />
    </svg>
  );
}

/**
 * CookieHalf
 * One half of the cracked cookie. "left" shows the left wing curving left;
 * "right" shows the mirrored version. Used during the crack animation.
 */
function CookieHalf({ side }: { side: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 85 120"
      width="110"
      height="145"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      {side === "left" ? (
        // Left lobe
        <path
          d="M80,60 C62,22 10,24 8,60 C8,92 56,98 80,60 Z"
          fill="rgba(0,255,65,0.08)"
          stroke={C.green}
          strokeWidth="2.2"
          style={{ filter: `drop-shadow(0 0 8px ${C.green})` }}
        />
      ) : (
        // Right lobe (translated so it starts at x=0 in its own viewBox)
        <path
          d="M5,60 C23,22 75,24 77,60 C77,92 29,98 5,60 Z"
          fill="rgba(0,255,65,0.08)"
          stroke={C.green}
          strokeWidth="2.2"
          style={{ filter: `drop-shadow(0 0 8px ${C.green})` }}
        />
      )}
    </svg>
  );
}

/**
 * GlowInput
 * A styled monospace text input with neon green focus glow.
 * Completely controlled; no native form submission.
 */
function GlowInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Field label */}
      <label
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.18em",
          color: C.greenDim,
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {/* Input element */}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: focused ? "rgba(0,255,65,0.07)" : C.surface,
          border: `1px solid ${focused ? C.green : C.border}`,
          borderRadius: "3px",
          padding: "13px 14px",
          color: C.green,
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "15px",
          outline: "none",
          width: "100%",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
          boxShadow: focused
            ? `0 0 0 2px ${C.greenGlow}, inset 0 0 16px rgba(0,255,65,0.04)`
            : "none",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MisfortuneCookie() {
  // ── Core app state ──────────────────────────────────────────────────────────
  const [appState, setAppState] = useState<AppState>("loading");

  // ── WebLLM loading feedback ─────────────────────────────────────────────────
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingSubtext, setLoadingSubtext] = useState("establishing connection to the void...");

  // ── User inputs ─────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");

  // ── Output ──────────────────────────────────────────────────────────────────
  const [fortune, setFortune] = useState("");

  // ── UX helpers ─────────────────────────────────────────────────────────────
  /** Toggles the CSS shake animation on the outermost wrapper */
  const [isShaking, setIsShaking] = useState(false);
  /** True once the cookie has settled; fades in the drag hint */
  const [showCrackHint, setShowCrackHint] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  /** Holds the initialised WebLLM MLCEngine instance between renders */
  const engineRef = useRef<any>(null);
  /** Ref to the result card div for html2canvas screenshot */
  const resultCardRef = useRef<HTMLDivElement>(null);

  // Framer-motion x value for tracking cookie drag distance
  const dragX = useMotionValue(0);

  // ── Global CSS injection ────────────────────────────────────────────────────
  // We inject a <style> tag so the keyframe animations are available globally
  // without needing a separate .css file (important for single-file deployments).

  // ── Phase 1: Initialise WebLLM engine on mount ──────────────────────────────
  useEffect(() => {
    const initEngine = async () => {
      // ① WebGPU availability check — graceful degradation
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        setAppState("unsupported");
        return;
      }

      try {
        // ② Dynamic import — avoids SSR errors (WebLLM uses browser-only APIs)
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

        // ③ Create engine with progress tracking
        engineRef.current = await CreateMLCEngine(MODEL_ID, {
          initProgressCallback: (report: { progress: number; text?: string }) => {
            const pct = Math.round((report.progress ?? 0) * 100);
            setLoadingProgress(pct);

            // Humanise the verbose technical progress text from WebLLM
            const raw = report.text ?? "";
            if (raw.toLowerCase().includes("fetching")) {
              setLoadingSubtext(`downloading oracle brain... ${pct}%`);
            } else if (raw.toLowerCase().includes("loading")) {
              setLoadingSubtext(`loading model weights into GPU... ${pct}%`);
            } else if (pct < 30) {
              setLoadingSubtext("summoning the cosmos to figure out what is wrong with you...");
            } else if (pct < 70) {
              setLoadingSubtext(`patience. the cosmos is judgmental but slow. ${pct}%`);
            } else {
              setLoadingSubtext(`almost there. sharpening its opinions... ${pct}%`);
            }
          },
        });

        setAppState("input");
      } catch (err) {
        // Engine init failure → fall back to unsupported screen with error note
        console.error("[MisfortuneCookie] WebLLM init failed:", err);
        setAppState("unsupported");
      }
    };

    initEngine();
  }, []);

  // ── Phase 2: Show crack hint once cookie settles ────────────────────────────
  useEffect(() => {
    if (appState === "waiting-crack") {
      // Delay the hint by 500 ms so the cookie spring fully settles first
      const t = setTimeout(() => setShowCrackHint(true), 500);
      return () => clearTimeout(t);
    }
    setShowCrackHint(false);
  }, [appState]);

  // ── Handler: Form → Cookie Drop ────────────────────────────────────────────
  const handleConsult = useCallback(() => {
    if (!name.trim() || !age.trim() || !location.trim()) return;
    setAppState("dropping");
    // After spring animation settles (~1.3 s), allow the user to crack
    setTimeout(() => setAppState("waiting-crack"), 1300);
  }, [name, age, location]);

  // ── Handler: Cookie Crack (drag or tap) ────────────────────────────────────
  const handleCrack = useCallback(() => {
    if (appState !== "waiting-crack") return;
    setAppState("cracking");

    // Fire the CSS shake animation
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 700);

    // Let the crack animation play before starting generation
    setTimeout(() => generateFortune(), 900);
  }, [appState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handler: LLM Fortune Generation ────────────────────────────────────────
  const generateFortune = useCallback(async () => {
    setAppState("generating");

    // Safety: if engine somehow wasn't ready, give a fallback message
    if (!engineRef.current) {
      setFortune("The oracle is taking a nap. Refresh and try again.");
      setAppState("result");
      return;
    }

    try {
      const response = await engineRef.current.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Name: ${name}, Age: ${age}, City: ${location}`,
          },
        ],
        max_tokens: 160,
        temperature: 0.92,  // High temp for unpredictable, spicy roasts
        top_p: 0.88,
      });

      const text =
        response.choices?.[0]?.message?.content?.trim() ||
        "The cosmos is genuinely speechless. That's how bad it is.";

      setFortune(text);
      setAppState("result");
    } catch (err) {
      console.error("[MisfortuneCookie] Generation error:", err);
      setFortune(
        "The cosmos took one look at your inputs and needed to lie down. Try again."
      );
      setAppState("result");
    }
  }, [name, age, location]);

  // ── Handler: Share via html2canvas ─────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!resultCardRef.current) return;
    try {
      // Dynamic import — html2canvas is heavy; lazy-load on demand
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(resultCardRef.current, {
        backgroundColor: C.bg,
        scale: 2,         // Retina-quality output
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `misfortune-${name.toLowerCase().replace(/\s/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("[MisfortuneCookie] html2canvas error:", err);
    }
  }, [name]);

  // ── Handler: Reset → back to input form ─────────────────────────────────────
  const handleReset = useCallback(() => {
    setFortune("");
    dragX.set(0);
    setAppState("input");
  }, [dragX]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Global style injection ────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Major+Mono+Display&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background: ${C.bg};
          min-height: 100dvh;
          overscroll-behavior: none;
        }

        /* Hide scrollbar but keep scroll */
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }

        /* Monospace placeholder text */
        ::placeholder {
          color: rgba(0,255,65,0.2);
          font-family: 'Share Tech Mono', monospace;
        }

        /* Pulsing glow — used on loading text and generating dots */
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 1;
            text-shadow: 0 0 8px ${C.green}, 0 0 22px rgba(0,255,65,0.5);
          }
          50% {
            opacity: 0.55;
            text-shadow: 0 0 4px ${C.greenDim}, 0 0 10px rgba(0,187,48,0.3);
          }
        }

        /* Violent multi-axis screen shake */
        @keyframes shake {
          0%   { transform: translate(0,0) rotate(0deg); }
          8%   { transform: translate(-9px,-7px) rotate(-2deg); }
          16%  { transform: translate(9px, 7px) rotate(2deg); }
          24%  { transform: translate(-9px, 7px) rotate(-1.5deg); }
          32%  { transform: translate(9px,-7px) rotate(1.5deg); }
          42%  { transform: translate(-6px,-5px) rotate(-1deg); }
          52%  { transform: translate(6px, 5px) rotate(1deg); }
          62%  { transform: translate(-4px,-4px) rotate(-0.5deg); }
          72%  { transform: translate(4px, 4px) rotate(0.5deg); }
          84%  { transform: translate(-2px, 2px) rotate(0deg); }
          92%  { transform: translate(2px,-2px) rotate(0deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }

        /* Slow ambient scan line moving upward */
        @keyframes scanUp {
          0%   { transform: translateY(110vh); opacity: 0; }
          5%   { opacity: 0.6; }
          95%  { opacity: 0.6; }
          100% { transform: translateY(-10vh); opacity: 0; }
        }

        /* Cursor blink for the terminal look */
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }

        /* Drag hint arrow bounce */
        @keyframes bounceLeft  { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-5px)} }
        @keyframes bounceRight { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
      `}</style>

      {/* ── Atmospheric overlays (always rendered, z-top, no pointer) ──────── */}
      <GrainOverlay />
      <ScanlineOverlay />

      {/* Single ambient scan line moving slowly from bottom to top */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(
              transparent,
              rgba(0,255,65,0.07),
              transparent
            )`,
            animation: "scanUp 10s linear infinite",
          }}
        />
      </div>

      {/* ── Page background grid ─────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(0,255,65,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,65,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      {/* ── Main wrapper — receives CSS shake animation ──────────────────── */}
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px 20px 40px",
          position: "relative",
          zIndex: 2,
          // Shake is a CSS animation toggled by state — cleaner than framer for this
          animation: isShaking ? "shake 0.7s cubic-bezier(.36,.07,.19,.97) both" : "none",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        {/* ── Content column (max 440 px, full width on mobile) ────────── */}
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <AnimatePresence mode="wait">

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: loading
             * Shows a spinning cookie + progress bar while WebLLM boots.
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {appState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.45 }}
                style={{ textAlign: "center" }}
              >
                {/* Spinning cookie emoji as informal loading indicator */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                  style={{ fontSize: "52px", marginBottom: "32px", display: "inline-block" }}
                >
                  🥠
                </motion.div>

                {/* App title */}
                <h1
                  style={{
                    fontFamily: "'Major Mono Display', monospace",
                    fontSize: "clamp(22px, 7vw, 32px)",
                    color: C.green,
                    letterSpacing: "0.02em",
                    lineHeight: 1.15,
                    marginBottom: "28px",
                    animation: "pulseGlow 2.2s ease-in-out infinite",
                  }}
                >
                  MISFORTUNE<br />COOKIE
                </h1>

                {/* Primary loading message */}
                <p
                  style={{
                    color: C.greenDim,
                    fontSize: "13px",
                    letterSpacing: "0.06em",
                    lineHeight: 1.8,
                    marginBottom: "28px",
                    animation: "pulseGlow 3s ease-in-out infinite",
                  }}
                >
                  Summoning the cosmos to figure out<br />
                  what is wrong with you...
                  {loadingProgress > 0 && (
                    <><br />
                      <span style={{ color: C.green, fontWeight: "bold" }}>
                        {loadingProgress}%
                      </span>
                    </>
                  )}
                </p>

                {/* Progress bar track */}
                <div
                  style={{
                    width: "100%",
                    height: "2px",
                    background: C.border,
                    borderRadius: "2px",
                    overflow: "hidden",
                    marginBottom: "10px",
                  }}
                >
                  {/* Animated fill */}
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background: C.green,
                      boxShadow: `0 0 10px ${C.green}, 0 0 20px rgba(0,255,65,0.5)`,
                    }}
                  />
                </div>

                {/* Subtext from WebLLM progress callback */}
                <p
                  style={{
                    color: "rgba(0,255,65,0.28)",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    lineHeight: 1.6,
                  }}
                >
                  {loadingSubtext}
                </p>

                {/* Note: first load downloads ~700 MB model; cached after that */}
                <p
                  style={{
                    marginTop: "20px",
                    color: "rgba(0,255,65,0.18)",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                  }}
                >
                  first run downloads ~700MB model · cached after that
                </p>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: unsupported
             * WebGPU not available — display clear instructions.
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {appState === "unsupported" && (
              <motion.div
                key="unsupported"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: "center" }}
              >
                {/* Warning symbol */}
                <div style={{ fontSize: "44px", marginBottom: "20px" }}>⚠️</div>

                <h2
                  style={{
                    fontFamily: "'Major Mono Display', monospace",
                    color: "#FF4141",
                    fontSize: "18px",
                    letterSpacing: "0.05em",
                    marginBottom: "18px",
                    textShadow: "0 0 16px rgba(255,65,65,0.5)",
                  }}
                >
                  COSMOS UNAVAILABLE
                </h2>

                <p
                  style={{
                    color: "rgba(255,90,90,0.7)",
                    fontSize: "13px",
                    lineHeight: 1.75,
                    letterSpacing: "0.04em",
                  }}
                >
                  Your browser doesn&apos;t support <strong style={{ color: "#FF7070" }}>WebGPU</strong>,
                  which is required to run the AI model locally.
                </p>

                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    border: "1px solid rgba(255,65,65,0.2)",
                    borderRadius: "4px",
                    background: "rgba(255,65,65,0.04)",
                    textAlign: "left",
                  }}
                >
                  <p style={{ color: "rgba(255,120,120,0.6)", fontSize: "11px", letterSpacing: "0.1em", marginBottom: "10px" }}>
                    // USE ONE OF THESE:
                  </p>
                  {[
                    "Chrome 113+ on desktop",
                    "Edge 113+ on desktop",
                    "Ensure hardware acceleration is ON",
                    "GPU must support WebGPU",
                  ].map((tip) => (
                    <div
                      key={tip}
                      style={{
                        color: "rgba(255,100,100,0.5)",
                        fontSize: "12px",
                        letterSpacing: "0.05em",
                        marginBottom: "5px",
                      }}
                    >
                      → {tip}
                    </div>
                  ))}
                </div>

                <p
                  style={{
                    marginTop: "18px",
                    color: "rgba(255,65,65,0.3)",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                  }}
                >
                  the cosmos runs locally. no cloud. no data sent anywhere.
                </p>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: input
             * Name / Age / Location form + the "Consult" CTA.
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {appState === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24, scale: 0.97 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* ── Header ── */}
                <div style={{ textAlign: "center", marginBottom: "38px" }}>
                  {/* Status badge */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      border: `1px solid ${C.border}`,
                      padding: "4px 12px",
                      borderRadius: "2px",
                      fontSize: "9px",
                      letterSpacing: "0.22em",
                      color: C.greenDim,
                      marginBottom: "18px",
                    }}
                  >
                    {/* Blinking status dot */}
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: C.green,
                        display: "inline-block",
                        animation: "blink 1.4s step-end infinite",
                        boxShadow: `0 0 6px ${C.green}`,
                      }}
                    />
                    ORACLE ONLINE // v2.1
                  </div>

                  {/* App title */}
                  <h1
                    style={{
                      fontFamily: "'Major Mono Display', monospace",
                      fontSize: "clamp(26px, 8vw, 36px)",
                      color: C.green,
                      lineHeight: 1.1,
                      letterSpacing: "0.02em",
                      textShadow: `0 0 24px ${C.greenGlow}, 0 0 50px rgba(0,255,65,0.18)`,
                    }}
                  >
                    MISFORTUNE<br />COOKIE
                  </h1>

                  <p
                    style={{
                      marginTop: "12px",
                      color: "rgba(0,255,65,0.35)",
                      fontSize: "11px",
                      letterSpacing: "0.14em",
                    }}
                  >
                    let the cosmos pass judgment
                  </p>
                </div>

                {/* ── Form fields ── */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    marginBottom: "28px",
                  }}
                >
                  <GlowInput
                    label="// your name"
                    value={name}
                    onChange={setName}
                    placeholder="what do people call you"
                  />
                  <GlowInput
                    label="// your age"
                    value={age}
                    onChange={setAge}
                    placeholder="in earth years"
                    type="number"
                  />
                  <GlowInput
                    label="// your city"
                    value={location}
                    onChange={setLocation}
                    placeholder="where you pretend to thrive"
                  />
                </div>

                {/* ── Submit button ── */}
                {/* Disabled until all three fields are filled */}
                <motion.button
                  onClick={handleConsult}
                  disabled={!name.trim() || !age.trim() || !location.trim()}
                  whileHover={
                    name && age && location ? { scale: 1.02 } : {}
                  }
                  whileTap={
                    name && age && location ? { scale: 0.96 } : {}
                  }
                  style={{
                    width: "100%",
                    padding: "16px",
                    background:
                      name && age && location ? C.green : "transparent",
                    border: `1px solid ${
                      name && age && location ? C.green : C.border
                    }`,
                    borderRadius: "3px",
                    color:
                      name && age && location ? C.bg : C.border,
                    fontFamily: "'Major Mono Display', monospace",
                    fontSize: "13px",
                    letterSpacing: "0.1em",
                    cursor:
                      name && age && location ? "pointer" : "not-allowed",
                    transition: "all 0.25s ease",
                    boxShadow:
                      name && age && location
                        ? `0 0 24px ${C.greenGlow}, 0 0 48px rgba(0,255,65,0.12)`
                        : "none",
                  }}
                >
                  CONSULT THE COSMOS
                </motion.button>

                {/* Privacy note */}
                <p
                  style={{
                    textAlign: "center",
                    marginTop: "14px",
                    color: "rgba(0,255,65,0.2)",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    lineHeight: 1.6,
                  }}
                >
                  runs 100% in your browser via webgpu<br />
                  no data is ever sent to any server
                </p>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: dropping + waiting-crack
             * The cookie enters from above with jello spring physics.
             * Once settled, user can drag sideways or tap to crack it.
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {(appState === "dropping" || appState === "waiting-crack") && (
              <motion.div
                key="cookie"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                style={{ textAlign: "center" }}
              >
                {/* Instruction text — fades in after cookie settles */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showCrackHint ? 1 : 0 }}
                  transition={{ duration: 0.6 }}
                  style={{
                    color: C.greenDim,
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    marginBottom: "42px",
                    height: "16px",
                  }}
                >
                  // drag or tap to crack open
                </motion.p>

                {/* The draggable / tappable cookie */}
                <motion.div
                  /**
                   * JELLO DROP:
                   * Initial position is y: -320 (above viewport).
                   * Spring config: low damping (8) + decent stiffness (160)
                   * creates the characteristic jello bounce with overshoot.
                   */
                  initial={{ y: -320, opacity: 0, rotate: -18, scale: 0.85 }}
                  animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 160,
                    damping: 8,
                    mass: 1.3,
                    opacity: { duration: 0.01 },
                  }}
                  /**
                   * DRAG CONFIG:
                   * Only active once cookie has settled (waiting-crack).
                   * Constrained to ±70 px horizontal travel.
                   * Crack triggers if drag offset > 45 px or velocity > 280 px/s.
                   */
                  drag={appState === "waiting-crack" ? "x" : false}
                  dragConstraints={{ left: -70, right: 70 }}
                  dragElastic={0.35}
                  onDragEnd={(_e, info) => {
                    const absX = Math.abs(info.offset.x);
                    const absV = Math.abs(info.velocity.x);
                    if (absX > 45 || absV > 280) {
                      handleCrack();
                    }
                  }}
                  onClick={appState === "waiting-crack" ? handleCrack : undefined}
                  whileHover={appState === "waiting-crack" ? { scale: 1.06 } : {}}
                  whileTap={appState === "waiting-crack" ? { scale: 0.92 } : {}}
                  style={{
                    display: "inline-block",
                    cursor:
                      appState === "waiting-crack" ? "grab" : "default",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    touchAction: "none",
                  }}
                >
                  <CookieWhole />
                </motion.div>

                {/* Animated ← CRACK IT → hint arrows */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: showCrackHint ? 1 : 0, y: showCrackHint ? 0 : 6 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    marginTop: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "14px",
                    color: C.greenDim,
                    fontSize: "12px",
                    letterSpacing: "0.16em",
                  }}
                >
                  <span style={{ animation: "bounceLeft 1.1s ease-in-out infinite" }}>←</span>
                  CRACK IT
                  <span style={{ animation: "bounceRight 1.1s ease-in-out infinite" }}>→</span>
                </motion.div>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: cracking
             * The two cookie halves violently fly apart.
             * A paper fortune slip launches upward between them.
             * The whole scene fades out as we transition to generating.
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {appState === "cracking" && (
              <motion.div
                key="cracking"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.65 }}
                style={{
                  textAlign: "center",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  position: "relative",
                  height: "180px",
                }}
              >
                {/* Left half — slides and rotates to the left */}
                <motion.div
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: -130, y: 50, rotate: -28, opacity: 0 }}
                  transition={{
                    duration: 0.55,
                    ease: [0.45, 0, 0.55, 1],
                  }}
                  style={{ position: "absolute" }}
                >
                  <CookieHalf side="left" />
                </motion.div>

                {/* Fortune paper flies out the middle and upward */}
                <motion.div
                  initial={{ y: 0, opacity: 1, scale: 0.9 }}
                  animate={{ y: -100, opacity: 0, scale: 1.2, rotate: -3 }}
                  transition={{ duration: 0.5, ease: [0.2, 0, 0.8, 1] }}
                  style={{
                    position: "absolute",
                    zIndex: 10,
                    background: C.bg,
                    border: `1px solid ${C.green}`,
                    padding: "7px 14px",
                    fontSize: "9px",
                    letterSpacing: "0.14em",
                    color: C.green,
                    whiteSpace: "nowrap",
                    boxShadow: `0 0 16px ${C.greenGlow}`,
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                >
                  YOUR TRUTH IS UNLOCKED
                </motion.div>

                {/* Right half — slides and rotates to the right */}
                <motion.div
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: 130, y: 50, rotate: 28, opacity: 0 }}
                  transition={{
                    duration: 0.55,
                    ease: [0.45, 0, 0.55, 1],
                  }}
                  style={{ position: "absolute" }}
                >
                  <CookieHalf side="right" />
                </motion.div>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: generating
             * Three bouncing green dots while LLM is producing text.
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {appState === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                style={{ textAlign: "center" }}
              >
                {/* Bouncing dot trio */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "10px",
                    marginBottom: "28px",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: C.green,
                        boxShadow: `0 0 10px ${C.green}, 0 0 22px rgba(0,255,65,0.4)`,
                      }}
                      animate={{ y: [0, -14, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{
                        duration: 0.85,
                        repeat: Infinity,
                        delay: i * 0.18,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>

                <p
                  style={{
                    color: C.greenDim,
                    fontSize: "13px",
                    letterSpacing: "0.1em",
                    lineHeight: 1.75,
                    animation: "pulseGlow 2.2s ease-in-out infinite",
                  }}
                >
                  the cosmos is composing<br />
                  your personal devastation...
                </p>

                <p
                  style={{
                    marginTop: "14px",
                    color: "rgba(0,255,65,0.2)",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                  }}
                >
                  LLM running locally on your GPU
                </p>
              </motion.div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             * STATE: result
             * Displays the generated fortune in a shareable card.
             * Actions: "Share My Misfortune" (html2canvas) and "Crack Another".
             * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {appState === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                style={{ width: "100%" }}
              >
                {/* ── Shareable fortune card ── */}
                {/* html2canvas will screenshot this div */}
                <div
                  ref={resultCardRef}
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: "5px",
                    padding: "28px 24px 24px",
                    marginBottom: "18px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Inner grid background for depth */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `
                        linear-gradient(rgba(0,255,65,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,255,65,0.025) 1px, transparent 1px)
                      `,
                      backgroundSize: "22px 22px",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Card header: app name + user identity */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "22px",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Major Mono Display', monospace",
                        color: C.green,
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        textShadow: `0 0 10px ${C.greenGlow}`,
                      }}
                    >
                      MISFORTUNE<br />COOKIE
                    </span>
                    <span
                      style={{
                        color: C.greenDim,
                        fontSize: "10px",
                        letterSpacing: "0.1em",
                        textAlign: "right",
                        lineHeight: 1.5,
                      }}
                    >
                      {name.toUpperCase()}<br />
                      AGE {age} · {location.toUpperCase()}
                    </span>
                  </div>

                  {/* Fortune text — left-border accent for visual weight */}
                  <div
                    style={{
                      borderLeft: `2px solid ${C.green}`,
                      paddingLeft: "16px",
                      marginBottom: "22px",
                      boxShadow: `-6px 0 20px ${C.greenGlow}`,
                      position: "relative",
                    }}
                  >
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.9, delay: 0.15 }}
                      style={{
                        color: C.text,
                        fontSize: "15px",
                        lineHeight: 1.8,
                        fontFamily: "'Share Tech Mono', monospace",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {fortune}
                    </motion.p>
                  </div>

                  {/* Card footer: blinking cursor + city attribution */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "rgba(0,255,65,0.22)",
                      fontSize: "9px",
                      letterSpacing: "0.14em",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        animation: "blink 1.6s step-end infinite",
                        fontSize: "10px",
                      }}
                    >
                      ■
                    </span>
                    {location.toLowerCase()} // the cosmos has spoken
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {/* Primary: download PNG via html2canvas */}
                  <motion.button
                    onClick={handleShare}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      width: "100%",
                      padding: "15px",
                      background: C.green,
                      border: "none",
                      borderRadius: "3px",
                      color: C.bg,
                      fontFamily: "'Major Mono Display', monospace",
                      fontSize: "12px",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                      boxShadow: `0 0 24px ${C.greenGlow}, 0 0 48px rgba(0,255,65,0.14)`,
                    }}
                  >
                    SHARE MY MISFORTUNE
                  </motion.button>

                  {/* Secondary: reset and go again */}
                  <motion.button
                    onClick={handleReset}
                    whileHover={{ scale: 1.02, borderColor: C.green }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      width: "100%",
                      padding: "15px",
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      borderRadius: "3px",
                      color: C.greenDim,
                      fontFamily: "'Major Mono Display', monospace",
                      fontSize: "12px",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                      transition: "border-color 0.2s ease, color 0.2s ease",
                    }}
                  >
                    CRACK ANOTHER
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
