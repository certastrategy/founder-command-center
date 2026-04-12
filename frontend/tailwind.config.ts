import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fcc: {
          bg: "#0A0A0F",
          surface: "#12121A",
          border: "#1E1E2E",
          text: "#E4E4E7",
          muted: "#71717A",
          accent: "#3B82F6",
          success: "#22C55E",
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
}

export default config
