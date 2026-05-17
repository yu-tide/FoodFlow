"use client";

import { Sparkles, UserRound } from "lucide-react";
import type { ChatMessage } from "@/services/assistant";

export function AssistantMessageList({
  messages,
  quickQuestions,
  onQuickQuestionClick,
}: {
  messages: ChatMessage[];
  quickQuestions?: string[];
  onQuickQuestionClick?: (q: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-green-100">
          <Sparkles className="h-7 w-7 text-green-600" />
        </div>
        <p className="text-[14px] font-black text-slate-600">FoodFlow AI 助手</p>
        <p className="text-[12px] font-bold text-slate-400">可以问我关于当前饮食记录、营养目标或每周统计的问题。</p>
        {quickQuestions && quickQuestions.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuickQuestionClick?.(q)}
                className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-green-100 hover:text-green-700"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${msg.role === "assistant" ? "bg-green-100" : "bg-slate-100"}`}>
            {msg.role === "assistant" ? <Sparkles className="h-3.5 w-3.5 text-green-600" /> : <UserRound className="h-3.5 w-3.5 text-slate-500" />}
          </div>
          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed ${
            msg.role === "assistant" ? "bg-slate-100 text-slate-700" : "bg-green-500 text-white"
          }`}>
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}
