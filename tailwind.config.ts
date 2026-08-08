import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(24,24,27,0.04), 0 8px 24px rgba(24,24,27,0.04)",
      },
      keyframes: {
        "facelab-scan": {
          "0%": { top: "12%", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { top: "82%", opacity: "0" },
        },
      },
      animation: {
        "facelab-scan": "facelab-scan 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
