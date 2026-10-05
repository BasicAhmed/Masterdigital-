import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        subtle: "rgb(var(--color-subtle) / <alpha-value>)",
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surface2: "rgb(var(--color-surface2) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          hot: "#5B8FE8",
          dim: "#072969",
          50: "#EAF1FB",
        },
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        whatsapp: { DEFAULT: "#25D366", dark: "#1DA851" },
        brand: {
          navy: "#072969",
          blue: "#1B4C99",
          royal: "#2156A8",
          gold: "#C9A227",
        },
      },
      fontFamily: {
        display: ["Alexandria", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Layered, navy-tinted elevation. --shadow-rgb swaps per theme.
        card: "0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 14px 34px -18px rgb(var(--shadow-rgb) / 0.28)",
        lift: "0 1px 0 0 rgb(var(--highlight-rgb) / 0.06) inset, 0 2px 4px rgb(var(--shadow-rgb) / 0.12), 0 24px 48px -16px rgb(var(--shadow-rgb) / 0.45)",
        soft: "0 1px 2px rgb(var(--shadow-rgb) / 0.05), 0 6px 16px -10px rgb(var(--shadow-rgb) / 0.22)",
        well: "inset 0 1px 2px rgb(var(--shadow-rgb) / 0.10)",
        glow: "0 8px 20px -10px rgb(var(--shadow-rgb) / 0.55)",
        "glow-lg": "0 0 0 1px rgb(var(--color-primary) / 0.25), 0 20px 60px -16px rgb(var(--color-primary) / 0.55)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #072969 0%, #1B4C99 55%, #3F7BDB 100%)",
        "dot-grid": "radial-gradient(rgb(var(--color-ink) / 0.07) 1px, transparent 1px)",
        "grid-fade":
          "radial-gradient(circle at 20% 0%, rgba(27,76,153,0.16), transparent 45%), radial-gradient(circle at 100% 30%, rgba(201,162,39,0.08), transparent 40%)",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ticker: "ticker 46s linear infinite",
        rise: "rise 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
