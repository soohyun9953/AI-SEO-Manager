"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

// 비밀번호 보호가 켜져 있고 로그인된 상태일 때만 보인다
export default function LogoutButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVisible(Boolean(data && data.required && data.authenticated)))
      .catch(() => setVisible(false));
  }, []);

  if (!visible) return null;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/[0.03] hover:text-white transition-all duration-300 text-gray-400 border border-transparent hover:border-white/[0.05] text-left"
    >
      <LogOut size={18} />
      <span className="font-medium text-sm tracking-tight">로그아웃</span>
    </button>
  );
}
