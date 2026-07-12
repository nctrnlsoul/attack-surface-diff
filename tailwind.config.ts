import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NorthSchema brand blue. Accents only.
        brand: {
          DEFAULT: "#4392E6",
          dark: "#2f6fb8",
        },
        // Attack-path red / closed-path green, kept muted for a basic render.
        danger: "#e0483d",
        safe: "#2fa36b",
      },
    },
  },
  plugins: [],
};

export default config;
