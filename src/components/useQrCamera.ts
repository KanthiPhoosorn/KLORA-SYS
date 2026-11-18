"use client";

import { useEffect, useRef, type RefObject } from "react";

type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

/**
 * Camera + QR decode loop shared by the receipt scan and the mini app. While `on` is true it opens the rear
 * camera into `videoRef` and about every 250 ms reads a frame with BarcodeDetector (when the browser supports
 * QR), else jsQR on a canvas. Every decoded text goes to `onText`; `onError` is called if the camera cannot open.
 */
export function useQrCamera(
  on: boolean,
  videoRef: RefObject<HTMLVideoElement | null>,
  onText: (text: string) => void,
  onError?: () => void,
) {
  // keep the newest callbacks without restarting the camera when they change
  const textRef = useRef(onText);
  const errRef = useRef(onError);
  useEffect(() => { textRef.current = onText; errRef.current = onError; });

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        // some browsers ship the detector without QR support, so check before trusting it
        const qrOk = BD ? await BD.getSupportedFormats?.().then((f) => f.includes("qr_code"), () => false) ?? true : false;
        const detector = BD && qrOk ? new BD({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        let working = false;
        timer = setInterval(async () => {
          if (working || !v.videoWidth) return;
          working = true;
          try {
            let text: string | undefined;
            if (detector) text = (await detector.detect(v))[0]?.rawValue;
            else if (jsQR) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) { ctx.drawImage(v, 0, 0); const img = ctx.getImageData(0, 0, canvas.width, canvas.height); text = jsQR(img.data, img.width, img.height)?.data; }
            }
            if (text) textRef.current(text);
          } catch { /* a bad frame: try the next one */ }
          working = false;
        }, 250);
      } catch { errRef.current?.(); }
    })();
    return () => { stopped = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on, videoRef]);
}
