import type { Config } from "tailwindcss";

// In Tailwind v4, most theme configuration has moved to CSS @theme blocks in
// client/src/index.css. This file is kept for IDE/tooling compatibility only.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
} satisfies Config;
