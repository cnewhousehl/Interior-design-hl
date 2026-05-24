import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Warm paper background
        paper: {
          DEFAULT: "#faf6ee",
          50: "#fdfbf5",
          100: "#faf6ee",
          200: "#f3ecd9",
          300: "#e8dec1",
        },
        // Deep ink for text
        ink: {
          DEFAULT: "#1c1917",
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
        },
        // Copper / terracotta accent
        accent: {
          DEFAULT: "#b45309",
          50: "#fef3c7",
          100: "#fde68a",
          400: "#d97706",
          500: "#b45309",
          600: "#92400e",
          700: "#78350f",
        },
        // Sage for success / valid clearances
        sage: {
          DEFAULT: "#5d7a5a",
          50: "#f1f5ef",
          400: "#7a9577",
          500: "#5d7a5a",
          600: "#456645",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28, 25, 23, 0.04), 0 0 1px rgba(28, 25, 23, 0.04)",
        panel: "0 2px 8px rgba(28, 25, 23, 0.06), 0 0 1px rgba(28, 25, 23, 0.08)",
        float: "0 8px 24px rgba(28, 25, 23, 0.10), 0 1px 4px rgba(28, 25, 23, 0.06)",
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.875rem",
      },
      animation: {
        "fade-in": "fadeIn 150ms ease-out",
        "slide-up": "slideUp 200ms ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
