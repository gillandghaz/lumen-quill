import type { Deps } from "../deps";
import type { CurrentUser } from "../session";
import { isAdmin } from "../session";
import { COLLECTIONS } from "../config";
import { HttpError } from "../errors";

/**
 * Profile photos: a 256 px JPEG made in the browser, stored as bytes in avatars/{uid} (Spark plan: no Storage needed).
 * The server re-checks the JPEG magic bytes and size. Served only to the owner and the admin, with
 * `Content-Type: image/jpeg`, nosniff and CSP `default-src 'none'`.
 */
const MAX_BYTES = 90_000;

export async function setAvatar(deps: Deps, uid: string, dataUrl: string): Promise<number> {
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  if (bytes.length < 100 || bytes.length > MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new HttpError(400, "invalid_image");
  }
  const version = deps.now();
  const batch = deps.db.batch();
  batch.set(deps.db.collection(COLLECTIONS.avatars).doc(uid), { bytes, updatedAt: version });
  batch.update(deps.db.collection(COLLECTIONS.users).doc(uid), { avatarVersion: version });
  await batch.commit();
  return version;
}

export async function removeAvatar(deps: Deps, uid: string): Promise<void> {
  const batch = deps.db.batch();
  batch.delete(deps.db.collection(COLLECTIONS.avatars).doc(uid));
  batch.update(deps.db.collection(COLLECTIONS.users).doc(uid), { avatarVersion: null });
  await batch.commit();
}

/** Own photo, or anyone's for the admin. Everything else is 404 (existence never leaks). */
export async function getAvatar(deps: Deps, viewer: CurrentUser, uid: string): Promise<{ bytes: Buffer; updatedAt: number } | null> {
  if (uid !== viewer.identity.uid && !isAdmin(viewer)) throw new HttpError(404, "not_found");
  const snap = await deps.db.collection(COLLECTIONS.avatars).doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data() as { bytes: Buffer | Uint8Array; updatedAt: number };
  return { bytes: Buffer.from(d.bytes), updatedAt: d.updatedAt };
}
