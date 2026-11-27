"use client";

/**
 * Turns a picked image into a small square JPEG data URL (256 px, centre-cropped). The server re-checks
 * type (JPEG magic bytes) and size; nothing but this JPEG ever leaves the browser.
 */
export const AVATAR_SIZE = 256;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 110_000;

export async function fileToAvatar(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is larger than 8 MB.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp || !bmp.width || !bmp.height) throw new Error("That image could not be read.");
  try {
    const side = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("That image could not be read.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    for (const q of [0.86, 0.72, 0.58, 0.45]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.startsWith("data:image/jpeg;base64,") && url.length <= MAX_DATA_URL_CHARS) return url;
    }
    throw new Error("That image is too detailed to store. Try another one.");
  } finally {
    bmp.close();
  }
}
