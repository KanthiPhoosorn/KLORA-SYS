// Browser-side: shrink a picked photo to ≤ `max` px on its long side as a JPEG before upload (keeps the
// stored image small — phone photos are 3–10 MB).
export function shrinkImage(file: File, max = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("อ่านรูปไม่ได้"));
    img.src = URL.createObjectURL(file);
  });
}
