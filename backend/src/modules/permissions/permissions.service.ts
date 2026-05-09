/** Permissions service — derives the permission key catalog. */
import { PERMISSION_KEYS, PERMISSION_LABELS_AR } from "@/lib/permissions";

export function listPermissions() {
  return Object.values(PERMISSION_KEYS).map((key) => ({
    key,
    labelAr: PERMISSION_LABELS_AR[key] || key,
  }));
}
