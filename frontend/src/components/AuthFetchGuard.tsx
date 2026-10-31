"use client";

import { useEffect } from "react";

// 세션이 만료되어 /api 요청이 401을 받으면 로그인 화면으로 보낸다
export default function AuthFetchGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      try {
        const target = args[0];
        const url = typeof target === "string" ? target : target instanceof URL ? target.pathname : target.url;
        if (
          response.status === 401 &&
          url.startsWith("/api/") &&
          !url.startsWith("/api/auth/") &&
          window.location.pathname !== "/login"
        ) {
          window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        }
      } catch {
        // 주소 해석에 실패해도 원래 응답은 그대로 돌려준다
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
