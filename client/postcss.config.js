import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite is started from repo root (scripts/build.ts); Tailwind otherwise resolves
// config from cwd and misses client/tailwind.config.ts → empty content + @apply errors.
// In Tailwind v4, the PostCSS plugin moved to @tailwindcss/postcss.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
