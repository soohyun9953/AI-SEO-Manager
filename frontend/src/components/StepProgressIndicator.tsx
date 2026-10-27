"use client";

import React from "react";
import { 
  CheckCircle2, 
  Loader2, 
  Circle, 
  Sparkles, 
  Clock, 
  AlertCircle 
} from "lucide-react";

// 단계 정의 인터페이스
export interface 단계_정보 {
  id: number;
  title: string;
  description: string;
  icon?: string;
}

// 클래스 한글어 표현 규칙 준수: 진행 단계를 관리하고 UI 상태를 계산하는 클래스
export class 진행_단계_관리자 {
  public total_steps: number;

  constructor(total_steps: number) {
    this.total_steps = total_steps;
  }

  // 현재 단계에 따른 진행률(%) 계산 함수 (스네이크 케이스)
  public calculate_percentage(current_step: number, is_completed: boolean): number {
    if (is_completed) return 100;
    if (current_step <= 0) return 5;
    const base_percent = Math.round(((current_step - 0.5) / this.total_steps) * 100);
    return Math.min(Math.max(base_percent, 10), 95);
  }

  // 단계 상태 문자열 반환 함수 (스네이크 케이스)
  public get_step_status(step_index: number, current_step: number, is_completed: boolean): "done" | "in_progress" | "pending" {
    if (is_completed || step_index < current_step) {
      return "done";
    }
    if (step_index === current_step) {
      return "in_progress";
    }
    return "pending";
  }
}

interface StepProgressIndicatorProps {
  steps: 단계_정보[];
  current_step: number;
  is_completed?: boolean;
  elapsed_seconds?: number;
  sub_message?: string;
  tip_message?: string;
}

export default function StepProgressIndicator({
  steps,
  current_step,
  is_completed = false,
  elapsed_seconds = 0,
  sub_message = "",
  tip_message = "",
}: StepProgressIndicatorProps) {
  const manager = new 진행_단계_관리자(steps.length);
  const progress_percent = manager.calculate_percentage(current_step, is_completed);

  return (
    <div className="w-full max-w-xl mx-auto p-6 rounded-3xl bg-slate-900/90 border border-blue-500/30 shadow-2xl backdrop-blur-xl space-y-6 animate-fadeIn">
      {/* 헤더 및 진행률 요약 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Sparkles size={20} className="animate-spin text-blue-400" style={{ animationDuration: "3s" }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                실시간 단계별 원고 생성 중
              </h3>
              <p className="text-xs text-slate-400">
                {sub_message || "설정하신 정보와 사진을 바탕으로 최적의 원고를 집필하고 있습니다."}
              </p>
            </div>
          </div>

          {/* 경과 시간 표시 */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700/60 text-xs font-mono text-blue-300">
            <Clock size={13} className="text-blue-400" />
            <span>{elapsed_seconds}초 경과</span>
          </div>
        </div>

        {/* 상단 프로그레스 바 */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-blue-400 flex items-center gap-1">
              {is_completed ? (
                "모든 단계 완료"
              ) : (
                `진행률 (${current_step}/${steps.length} 단계)`
              )}
            </span>
            <span className="text-blue-300 font-mono text-sm">{progress_percent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-blue-500/50"
              style={{ width: `${progress_percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 단계별 카드 리스트 */}
      <div className="space-y-2.5">
        {steps.map((step_item, index) => {
          const step_number = index + 1;
          const status = manager.get_step_status(step_number, current_step, is_completed);

          let card_bg = "bg-slate-800/40 border-slate-700/40 text-slate-400";
          let badge = (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-medium">
              대기
            </span>
          );
          let icon_el = <Circle size={18} className="text-slate-500 flex-shrink-0" />;

          if (status === "done") {
            card_bg = "bg-emerald-950/20 border-emerald-500/30 text-emerald-100 shadow-sm";
            badge = (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] text-emerald-300 font-semibold border border-emerald-500/30">
                완료됨
              </span>
            );
            icon_el = <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />;
          } else if (status === "in_progress") {
            card_bg = "bg-blue-950/40 border-blue-500/50 text-white shadow-md shadow-blue-900/20 ring-1 ring-blue-500/30";
            badge = (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-[10px] text-blue-300 font-bold border border-blue-500/40 animate-pulse">
                진행 중...
              </span>
            );
            icon_el = <Loader2 size={18} className="text-blue-400 animate-spin flex-shrink-0" />;
          }

          return (
            <div
              key={step_item.id}
              className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-start gap-3 ${card_bg}`}
            >
              <div className="mt-0.5">{icon_el}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                    <span className="font-mono text-slate-400">Step {step_number}.</span>
                    <span className={status === "in_progress" ? "text-blue-200" : ""}>
                      {step_item.title}
                    </span>
                  </div>
                  {badge}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400 line-clamp-2">
                  {step_item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 안내 알림 팁 박스 */}
      {tip_message ? (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px] text-amber-200/90">
            {tip_message}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-blue-200 text-xs flex items-start gap-2.5">
          <Sparkles size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px] text-blue-300/80">
            인공지능이 실제 방문 경험처럼 자연스럽고 생생한 문장과 소제목, 해시태그를 정밀하게 구성하고 있습니다.
          </div>
        </div>
      )}
    </div>
  );
}
