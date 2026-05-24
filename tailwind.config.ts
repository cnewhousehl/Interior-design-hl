import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        paper: "#fafaf7",
        wall: "#2b2b2b",
        accent: "#c2410c",
      },
    },
  },
  plugins: [],
};

export default config;
