"use client";

import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

export function AssistantComposer({
  onSend,
  sending,
}: {
  onSend: (message: string) => void;
  sending: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        placeholder="输入你的问题..."
        className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[13px] font-bold outline-none focus:border-green-500 focus:bg-white"
        disabled={sending}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim() || sending}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-600 text-white transition hover:bg-green-700 disabled:opacity-40"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </div>
  );
}
