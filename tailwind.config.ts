import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        manifest: {
          black: "#050506",
          panel: "#111114",
          panel2: "#17171c",
          line: "#2b2b31",
          red: "#e31937",
          redDark: "#8d1022",
          muted: "#a2a2aa",
          quiet: "#6f707a",
          green: "#1ec27f",
          amber: "#f4b740",
          orange: "#f97316",
          danger: "#ff4d5d",
        },
      },
      boxShadow: {
        premium: "0 24px 80px rgba(0, 0, 0, 0.45)",
      },
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
