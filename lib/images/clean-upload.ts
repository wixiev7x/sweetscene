/**
 * Re-encode an uploaded image in the browser. Drawing to a canvas and
 * exporting drops ALL metadata (EXIF GPS, camera, author), normalises
 * orientation, and caps the size. Output is WebP (JPEG fallback).
 */
export async function cleanImage(file: File, maxSide = 1600, quality = 0.88): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("That image is too large (max 12 MB before compression).");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  if (w < 200 || h < 200) throw new Error("Image is too small (min 200×200).");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  const out = (await toBlob("image/webp")) ?? (await toBlob("image/jpeg"));
  if (!out) throw new Error("Couldn't process the image.");
  if (out.size > 2 * 1024 * 1024) throw new Error("Image is still over 2 MB after compression; try a smaller one.");
  return out;
}
