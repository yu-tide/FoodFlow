import { apiPost } from "./api";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  message: string;
  page: string;
  page_context: Record<string, string>;
  session_id?: string;
  history?: ChatMessage[];
};

export type ChatResponse = {
  answer: string;
  session_id: string;
  sources?: Array<{ title: string; url?: string }>;
  suggested_actions?: string[];
};

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  return apiPost<ChatResponse>("/api/assistant/chat", req);
}
