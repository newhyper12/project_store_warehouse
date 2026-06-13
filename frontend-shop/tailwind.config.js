/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
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
