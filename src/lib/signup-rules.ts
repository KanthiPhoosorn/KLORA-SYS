// Field rules shared by the sign-up forms (client) and their APIs (server). No server imports here.
export const PASSWORD_RULE = "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลข";
export const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
export const phoneOk = (p: string) => /^0\d{8,9}$/.test(p.replace(/[\s-]/g, ""));
export const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
