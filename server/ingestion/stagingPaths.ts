import os from "node:os";
import path from "node:path";

/**
 * Directory where multer stores uploaded zip/audio before ingest.
 * Must match `uploadIngest` dest in `server/routes.ts`.
 */
export function ingestMultipartStagingDir(): string {
  return path.join(os.tmpdir(), "debrief-upload");
}
