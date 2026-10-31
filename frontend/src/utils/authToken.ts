import { createHmac, timingSafeEqual } from "node:crypto";

// backend/auth_guard.py 와 같은 토큰 형식: "<만료 epoch초>.<hex(HMAC-SHA256(비밀번호, 'v1.<만료>'))>"
export const SESSION_COOKIE = "seo_session";

// 로컬 개발에서는 APP_PASSWORD가 없으면 꺼지고, Vercel 배포에서는 없으면 전부 잠근다
export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD) || Boolean(process.env.VERCEL);
}

export function verifyToken(token: string | undefined): boolean {
  const password = process.env.APP_PASSWORD;
  if (!password || !token) return false;

  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expiry = Number(token.slice(0, dot));
  const signature = token.slice(dot + 1);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return false;

  const expected = createHmac("sha256", password).update(`v1.${expiry}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
