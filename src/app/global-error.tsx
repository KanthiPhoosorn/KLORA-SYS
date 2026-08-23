"use client";

// Root error boundary: replaces the whole document if the root layout itself throws,
// so it must render its own <html>/<body> and can't rely on Tailwind being present.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#fff",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>ระบบขัดข้อง</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>
            เกิดข้อผิดพลาดร้ายแรง กรุณาลองใหม่อีกครั้ง
          </p>
          {error.digest ? (
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>รหัสอ้างอิง: {error.digest}</p>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              background: "#ff1694",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ลองอีกครั้ง
          </button>
        </div>
      </body>
    </html>
  );
}
