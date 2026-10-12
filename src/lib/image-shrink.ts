// Browser-side: shrink a picked photo to ≤ `max` px on its long side as a JPEG before upload (keeps the
// stored image small — phone photos are 3–10 MB). `stamp` burns a caption band into the bottom of the
// picture (packing photos: date · time · farm on the left, "Corta" on the right).
export function shrinkImage(file: File, max = 1200, quality = 0.82, stamp?: { left: string; right?: string }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, c.width, c.height);
      if (stamp) {
        const fs = Math.max(14, Math.round(c.width * 0.032));
        const band = Math.round(fs * 1.9);
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(0, c.height - band, c.width, band);
        g.textBaseline = "middle";
        g.fillStyle = "#ffffff";
        g.font = `600 ${fs}px "Noto Sans Thai", "Prompt", sans-serif`;
        g.textAlign = "left";
        g.fillText(stamp.left, Math.round(fs * 0.7), c.height - band / 2, c.width * 0.78);
        if (stamp.right) { g.textAlign = "right"; g.fillStyle = "#ffd5d7"; g.fillText(stamp.right, c.width - Math.round(fs * 0.7), c.height - band / 2); }
      }
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("อ่านรูปไม่ได้"));
    img.src = URL.createObjectURL(file);
  });
}
