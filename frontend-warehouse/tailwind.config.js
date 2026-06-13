/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        accent: {
          50:  "#ecfeff",
          100: "#cffafe",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
        },
        supplier: {
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        ink: "#0f172a",
        line: "#e2e8f0",
        muted: "#64748b",
      },
      boxShadow: {
        soft: "0 8px 24px -8px rgba(15,23,42,0.08), 0 2px 6px -2px rgba(15,23,42,0.06)",
        card: "0 1px 2px rgba(15,23,42,0.06), 0 4px 14px rgba(15,23,42,0.06)",
        lift: "0 18px 40px -18px rgba(37,99,235,0.30), 0 4px 12px rgba(15,23,42,0.06)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "scale-in": { "0%": { opacity: 0, transform: "scale(.96)" }, "100%": { opacity: 1, transform: "scale(1)" } },
        shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        "pulse-dot": { "0%,100%": { opacity: .35 }, "50%": { opacity: 1 } },
      },
      animation: {
        "fade-up": "fade-up .35s ease both",
        "scale-in": "scale-in .2s ease both",
      },
    },
  },
  plugins: [],
};
