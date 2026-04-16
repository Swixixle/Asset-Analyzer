import fs from "node:fs/promises";
import path from "node:path";
import extract from "extract-zip";

const ROOT_MARKERS = ["package.json", "pyproject.toml", "go.mod", "Cargo.toml"];

async function hasMarker(dir: string, name: string): Promise<boolean> {
  try {
    const st = await fs.stat(path.join(dir, name));
    return st.isFile();
  } catch {
    return false;
  }
}

/** Deepest directory under root that contains a known project marker (prefer nested monorepo roots). */
export async function findProjectRoot(extractRoot: string): Promise<string> {
  let best = extractRoot;
  let bestDepth = -1;

  async function walk(dir: string, depth: number): Promise<void> {
    let entries: { name: string; isDir: boolean }[];
    try {
      const names = await fs.readdir(dir, { withFileTypes: true });
      entries = names.map((d) => ({ name: d.name, isDir: d.isDirectory() }));
    } catch {
      return;
    }

    for (const marker of ROOT_MARKERS) {
      if (await hasMarker(dir, marker)) {
        if (depth > bestDepth) {
          bestDepth = depth;
          best = dir;
        }
      }
    }

    for (const e of entries) {
      if (!e.isDir || e.name === "node_modules" || e.name.startsWith(".")) continue;
      await walk(path.join(dir, e.name), depth + 1);
    }
  }

  await walk(extractRoot, 0);
  return best;
}

/**
 * Extract a zip into destDir with zip-slip protection (uses extract-zip / yauzl guards).
 */
export async function extractZipToDir(zipPath: string, destDir: string): Promise<void> {
  const resolvedDest = path.resolve(destDir);
  await fs.mkdir(resolvedDest, { recursive: true });
  await extract(zipPath, { dir: resolvedDest });
}
