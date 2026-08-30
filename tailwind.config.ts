import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        route: "var(--route)",
        "route-soft": "var(--route-soft)",
        marker: "var(--marker)",
        "marker-soft": "var(--marker-soft)",
        good: "var(--good)",
        warn: "var(--warn)",
        bad: "var(--bad)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,30,26,0.04), 0 8px 24px -12px rgba(33,30,26,0.12)",
        lift: "0 2px 4px rgba(33,30,26,0.06), 0 18px 40px -16px rgba(33,30,26,0.22)",
      },
      keyframes: {
        "route-dash": {
          from: { strokeDashoffset: "1000" },
          to: { strokeDashoffset: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "route-dash": "route-dash 1.4s ease-out forwards",
        "fade-up": "fade-up 0.35s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
