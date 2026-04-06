import { HelpCircle, Book, MessageSquare, ExternalLink } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gray-500/10 rounded-2xl flex items-center justify-center border border-gray-500/20">
          <HelpCircle className="text-gray-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white tracking-tight">도움말 센터</h1>
          <p className="text-sm text-gray-400 mt-1">AI SEO Manager의 사용 방법과 지원을 확인하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 flex flex-col gap-4 interactive-hover relative group overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Book className="text-blue-500" size={20} />
          </div>
          <h2 className="text-lg font-bold text-white">가이드 모음</h2>
          <p className="text-sm text-gray-400 leading-relaxed flex-1">
            Gemini 2.5를 활용하는 프롬프트 작성법, Imagen 3 사용 방법 등 상세 매뉴얼을 제공합니다.
          </p>
          <button className="text-sm font-bold text-blue-400 flex items-center gap-2 group-hover:translate-x-1 transition-transform w-fit mt-2">
            가이드 읽기 <ExternalLink size={14} />
          </button>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="glass-card p-6 flex flex-col gap-4 interactive-hover relative group overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <MessageSquare className="text-emerald-500" size={20} />
          </div>
          <h2 className="text-lg font-bold text-white">지원 요청</h2>
          <p className="text-sm text-gray-400 leading-relaxed flex-1">
            API 키 설정 문제나 예상치 못한 에러가 발생한 경우 고객 지원 센터로 문의해 주세요.
          </p>
          <button className="text-sm font-bold text-emerald-400 flex items-center gap-2 group-hover:translate-x-1 transition-transform w-fit mt-2">
            문의하기 <ExternalLink size={14} />
          </button>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      
      <div className="glass-card p-8 mt-4 text-center border-dashed">
        <h3 className="text-lg font-bold text-gray-300 mb-2">원하시는 답변을 찾지 못하셨나요?</h3>
        <p className="text-sm text-gray-500 mb-6">담당 관리자에게 직접 메일을 보내시면 빠르게 답변해 드립니다.</p>
        <button className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm border border-white/5">
          이메일 보내기
        </button>
      </div>
    </div>
  );
}
