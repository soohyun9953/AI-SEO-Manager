import { redirect } from "next/navigation";

export default function DashboardPage() {
  // 대시보드 대신 체험·방문 후기(티스토리) 작성 화면으로 바로 이동합니다.
  redirect("/experience-reviews");
}
