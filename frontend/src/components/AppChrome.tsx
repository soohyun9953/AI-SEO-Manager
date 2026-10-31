"use client";

import { usePathname } from "next/navigation";
import ApiKeyHeader from "@/components/ApiKeyHeader";

// 로그인 화면에서는 사이드바 없이 본문만 보여주고, 그 외 화면은 기존 레이아웃을 그대로 쓴다
export default function AppChrome({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden relative">
      {sidebar}

      {/* Main Visual Component Hub */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
        <ApiKeyHeader />
        <main className="flex-1 overflow-y-auto px-10 py-8 relative scroll-smooth focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
