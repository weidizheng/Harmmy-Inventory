export async function prepareProductImage(file: File): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("原始图片不能超过 20 MB。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("无法读取该图片格式，请改用 JPEG、PNG 或 WebP。");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("图片压缩失败，请换一张图片重试。");
  if (blob.size > 5 * 1024 * 1024) throw new Error("压缩后的图片仍超过 5 MB，请换一张较小的图片。");
  return blob;
}

export function createProductImagePath(sku: string) {
  const safeSku = sku.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `products/${safeSku}/${crypto.randomUUID()}-main.jpg`;
}
