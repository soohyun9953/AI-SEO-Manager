import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { LayoutDashboard, PenTool, Image as ImageIcon, Search, Settings, HelpCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import ApiKeyHeader from "@/components/ApiKeyHeader";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "AI SEO Manager | Next-Gen Automation",
  description: "Experience the power of AI-driven search engine optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${outfit.variable} dark`}>
      <body className="bg-[#050508] text-slate-200 antialiased font-sans selection:bg-blue-500/30 selection:text-blue-200">
        <div className="bg-mesh" />
        <div className="flex h-screen overflow-hidden relative">
          
          {/* Enhanced Sidebar */}
          <aside className="w-64 bg-[#0a0a0f]/60 backdrop-blur-3xl border-r border-white/[0.05] p-6 flex flex-col gap-8 z-40 relative overflow-hidden flex-shrink-0">
            <Link href="/" className="flex items-center gap-3 px-2 group">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-all duration-500">
                <span className="font-bold text-xl text-white">S</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-white font-outfit">SEO Manager</span>
                <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold opacity-80">Enterprise AI</span>
              </div>
            </Link>
            
            <nav className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-4 mb-2">Workspace</p>
              <NavItem href="/keywords" icon={<Search size={18} />} label="키워드 엔진" />
              <NavItem href="/editor" icon={<PenTool size={18} />} label="SEO 라이터" />
              <NavItem href="/images" icon={<ImageIcon size={18} />} label="이미지 생성기" />
              <NavItem href="/auto-write" icon={<Sparkles size={18} />} label="자동 글작성" />
            </nav>

            <nav className="mt-auto flex flex-col gap-1.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-4 mb-2">Support</p>
              <NavItem href="/settings" icon={<Settings size={18} />} label="환경 설정" />
              <NavItem href="/help" icon={<HelpCircle size={18} />} label="도움말 센터" />
            </nav>

            <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-white/[0.05] flex flex-col gap-3 relative overflow-hidden group">
               <div className="relative z-10">
                  <p className="text-xs font-bold text-white mb-1 leading-tight">Pro Plan Active</p>
                  <p className="text-[10px] text-gray-400">Gemini 2.5 Flash & Imagen 3 Enabled</p>
               </div>
               <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-600/20 blur-2xl group-hover:scale-150 transition-all duration-500" />
            </div>
          </aside>

          {/* Main Visual Component Hub */}
          <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
            <ApiKeyHeader />
            <main className="flex-1 overflow-y-auto px-10 py-8 relative scroll-smooth focus:outline-none">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/[0.03] hover:text-white transition-all duration-300 text-gray-400 group relative border border-transparent hover:border-white/[0.05] hover:shadow-xl"
    >
      <div className="group-hover:text-blue-500 transition-colors duration-300">
        {icon}
      </div>
      <span className="font-medium text-sm tracking-tight">{label}</span>
      <div className="absolute left-0 w-1 h-0 bg-blue-600 rounded-full group-hover:h-4 group-hover:translate-y-0 transition-all duration-300" />
    </Link>
  );
}
