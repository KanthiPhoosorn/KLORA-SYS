// When a JPEG photo was taken, from its EXIF (DateTimeOriginal, else DateTime), as an ISO string. Pure —
// runs in the browser on the ORIGINAL file before it is shrunk (drawing on a canvas drops EXIF).
// EXIF stores local time; OffsetTimeOriginal gives the zone when the camera wrote it, else Thailand (+07:00).
// Anyone determined can edit EXIF — this is a signal, compared with the server's upload time.

export function exifTakenAt(buf: ArrayBuffer): string | undefined {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return undefined; // not a JPEG
  let p = 2;
  while (p + 4 <= v.byteLength) {
    if (v.getUint8(p) !== 0xff) return undefined;
    const marker = v.getUint8(p + 1);
    const len = v.getUint16(p + 2);
    if (marker === 0xda || marker === 0xd9) return undefined; // image data started — no EXIF
    if (marker === 0xe1 && p + 10 <= v.byteLength && ascii(v, p + 4, 4) === "Exif") return fromTiff(v, p + 10, Math.min(v.byteLength, p + 2 + len));
    p += 2 + len;
  }
  return undefined;
}

function ascii(v: DataView, at: number, n: number): string {
  let s = "";
  for (let i = 0; i < n && at + i < v.byteLength; i++) { const c = v.getUint8(at + i); if (c === 0) break; s += String.fromCharCode(c); }
  return s;
}

function fromTiff(v: DataView, t: number, end: number): string | undefined {
  if (t + 8 > end) return undefined;
  const le = v.getUint16(t) === 0x4949; // "II" little endian, "MM" big endian
  const u16 = (o: number) => v.getUint16(o, le);
  const u32 = (o: number) => v.getUint32(o, le);
  if (u16(t + 2) !== 42) return undefined;
  // read one IFD → { tag: ascii value or pointer }
  const ifd = (off: number) => {
    const out = new Map<number, { type: number; count: number; at: number }>();
    const at = t + off;
    if (off <= 0 || at + 2 > end) return out;
    const n = u16(at);
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      if (e + 12 > end) break;
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), at: e + 8 });
    }
    return out;
  };
  const str = (e?: { type: number; count: number; at: number }) => {
    if (!e || e.type !== 2) return undefined; // ASCII
    const at = e.count > 4 ? t + u32(e.at) : e.at;
    return at + e.count <= end ? ascii(v, at, e.count) : undefined;
  };
  const ifd0 = ifd(u32(t + 4));
  const exifPtr = ifd0.get(0x8769);
  const exif = exifPtr ? ifd(u32(exifPtr.at)) : new Map();
  const when = str(exif.get(0x9003)) ?? str(exif.get(0x9004)) ?? str(ifd0.get(0x0132));
  const zone = str(exif.get(0x9011)) ?? str(exif.get(0x9010));
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(when ?? "");
  if (!m || m[1] === "0000") return undefined;
  const tz = zone && /^[+-]\d{2}:\d{2}$/.test(zone) ? zone : "+07:00";
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
