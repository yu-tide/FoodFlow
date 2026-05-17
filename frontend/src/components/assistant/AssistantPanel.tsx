"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minimize2, X } from "lucide-react";
import { AssistantMessageList } from "./AssistantMessageList";
import { AssistantComposer } from "./AssistantComposer";
import { sendChatMessage, type ChatMessage } from "@/services/assistant";

export function AssistantPanel({
  page,
  pageContext,
  quickQuestions,
  onClose,
}: {
  page: string;
  pageContext: Record<string, string>;
  quickQuestions?: string[];
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const res = await sendChatMessage({
        message: text,
        page,
        page_context: pageContext,
        session_id: sessionId,
        history: messages.slice(-6),
      });
      setSessionId(res.session_id);
      const aiMsg: ChatMessage = { role: "assistant", content: res.answer };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，AI 助手暂时不可用。请稍后重试。" }]);
    } finally {
      setSending(false);
    }
  }, [page, pageContext, sessionId, messages]);

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.12)] transition-all duration-200 ${
      minimized ? "h-[52px]" : "h-[480px] max-h-[calc(100vh-120px)]"
    }`}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-green-100">
            <span className="text-[13px]">✨</span>
          </div>
          <span className="text-[14px] font-black text-slate-700">FoodFlow AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMinimized(!minimized)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
            <AssistantMessageList messages={messages} quickQuestions={quickQuestions} onQuickQuestionClick={handleSend} />
          </div>
          <AssistantComposer onSend={handleSend} sending={sending} />
        </>
      )}
    </div>
  );
}
