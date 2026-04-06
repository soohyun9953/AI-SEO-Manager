import { redirect } from "next/navigation";

export default function DashboardPage() {
  // 대시보드 대신 SEO 라이터(에디터)로 바로 이동합니다.
  redirect("/editor");
}
