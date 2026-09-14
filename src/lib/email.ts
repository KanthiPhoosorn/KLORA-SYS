// Transactional email via Resend's HTTP API (no SDK needed — works on Vercel serverless).
// Env: RESEND_API_KEY (required to actually send) and EMAIL_FROM, e.g. "KLORA <no-reply@corta.tech>"
// — the sender domain must be verified in Resend, otherwise Resend's sandbox sender only
// delivers to the Resend account owner's own inbox.
// Graceful fallback: with no RESEND_API_KEY the message is logged and { sent:false } returned,
// so every flow still works in local/dev. Callers must NOT leak OTP codes in production.

export interface Mail {
  to: string;
  subject: string;
  html: string;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(mail: Mail): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[KLORA] (email not configured) to=${mail.to} subject=${mail.subject}\n${mail.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
    return { sent: false };
  }
  const from = process.env.EMAIL_FROM || "KLORA <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, html: mail.html }),
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

const wrap = (body: string) =>
  `<div style="font-family:'Noto Sans Thai',Inter,sans-serif;line-height:1.7;color:#0f172a;max-width:520px">` +
  `<p style="font-weight:700;color:#ff1694;font-size:18px;margin:0 0 12px">KLORA</p>${body}` +
  `<p style="color:#94a3b8;font-size:12px;margin-top:24px">อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p></div>`;

// Password-reset OTP. Only the code is sent — never a link — so the message works on any domain.
export function sendOtpEmail(to: string, code: string) {
  return sendEmail({
    to,
    subject: "รหัสยืนยันการรีเซ็ตรหัสผ่าน KLORA",
    html: wrap(
      `<p>คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี KLORA</p>` +
        `<p>รหัส OTP ของคุณคือ</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#ff1694">${code}</p>` +
        `<p style="color:#64748b;font-size:13px">รหัสนี้จะหมดอายุใน 10 นาที หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยอีเมลฉบับนี้</p>`,
    ),
  });
}

// Team invite (จัดการระบบ → เชิญผู้ใช้). Links to registration on the current deployment.
export function sendInviteEmail(to: string, orgName: string, role: string, origin: string) {
  const roleTh = role === "org_admin" ? "ผู้ดูแลองค์กร" : "สมาชิก";
  const link = `${origin}/register`;
  return sendEmail({
    to,
    subject: `คุณได้รับเชิญให้เข้าร่วม ${orgName} บน KLORA`,
    html: wrap(
      `<p><strong>${orgName}</strong> เชิญคุณเข้าร่วมทีมบน KLORA ในบทบาท <strong>${roleTh}</strong></p>` +
        `<p>สมัครสมาชิกด้วยอีเมลนี้ (${to}) เพื่อเริ่มใช้งาน</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#ff1694;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">สมัครสมาชิก</a></p>` +
        `<p style="color:#64748b;font-size:13px">หรือเปิดลิงก์ ${link}</p>`,
    ),
  });
}
