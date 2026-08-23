// Transactional email via Resend's HTTP API (no SDK needed — works on Vercel serverless).
// Graceful fallback: with no RESEND_API_KEY the OTP is logged and { sent:false } returned,
// so the flow still works in local/dev. In production the caller must NOT leak the code.

export async function sendOtpEmail(to: string, code: string): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[KLORA] (email not configured) OTP for ${to}: ${code}`);
    return { sent: false };
  }
  const from = process.env.EMAIL_FROM || "KLORA <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "รหัสยืนยันการรีเซ็ตรหัสผ่าน KLORA",
        html:
          `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a">` +
          `<p>คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี KLORA</p>` +
          `<p>รหัส OTP ของคุณคือ</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#ff1694">${code}</p>` +
          `<p style="color:#64748b;font-size:13px">รหัสนี้จะหมดอายุใน 10 นาที หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยอีเมลฉบับนี้</p>` +
          `</div>`,
      }),
    });
    if (!res.ok) {
      console.error(`[KLORA] Resend send failed: ${res.status} ${await res.text()}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error("[KLORA] Resend error", e);
    return { sent: false };
  }
}
