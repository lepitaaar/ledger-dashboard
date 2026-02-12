import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1e5fa0",
        background: "#f3f4f6",
        card: "#ffffff",
        border: "#dbe3ed",
        muted: "#6b7280",
        accent: "#f97316",
      },
      borderRadius: {
        lg: "10px",
        md: "8px",
        sm: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
