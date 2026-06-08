/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#c9a84c",
          light: "#e8d5a0",
          dark: "#8a6a20",
          muted: "rgba(201,168,76,0.15)",
        },
        dark: {
          bg: "#0b0b10",
          surface: "#111119",
          surface2: "#1a1a25",
          border: "rgba(201,168,76,0.12)",
        },
        text: {
          primary: "#f0ede0",
          secondary: "#9494a6",
          muted: "#5a5a6e",
        },
        positive: "#3d9e6e",
        negative: "#c84848",
        warning: "#d4834a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
