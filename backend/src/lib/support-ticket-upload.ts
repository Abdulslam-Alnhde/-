/** Limits and public media root for support ticket attachments. */
import path from "node:path";

export const SUPPORT_TICKET_MAX_MESSAGE = 8000;
export const SUPPORT_TICKET_MAX_FILES = 6;
export const SUPPORT_TICKET_MAX_BYTES_PER_FILE = 4 * 1024 * 1024;

export function mediaPublicRoot(): string {
  const fromEnv = process.env.MEDIA_PUBLIC_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "..", "frontend", "public");
}
