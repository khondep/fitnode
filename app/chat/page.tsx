"use client";

import { useState, useRef, useEffect } from "react";
import { Send, FileText, Mail, Sparkles } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tailoredResume?: string;
  coldEmail?: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const jobDescription = input;
    setMessages((prev) => [...prev, { role: "user", content: jobDescription }]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription }),
    });
    const data = await res.json();

    if (data.error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${data.error}` },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Here's your tailored resume and a draft cold email for this role:",
          tailoredResume: data.tailoredResume,
          coldEmail: data.coldEmail,
        },
      ]);
    }

    setLoading(false);
  }

  return (
    <main className="w-full flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Tailor Chat</h1>
        <p className="text-gray-400">
          Paste any job description to get an instantly tailored resume and cold email.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
        {messages.length === 0 && (
          <div className="border border-gray-800 rounded-xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-gray-400 mb-1">Paste a job description to get started</p>
            <p className="text-sm text-gray-600">
              Works with any role — we'll tailor your most recent uploaded resume.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-xl p-5 border ${
              msg.role === "user"
                ? "bg-gray-900 border-gray-800"
                : "bg-gray-950 border-gray-800"
            }`}
          >
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              {msg.role === "user" ? "You pasted" : "FitNode"}
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {msg.role === "user"
                ? msg.content.slice(0, 300) + (msg.content.length > 300 ? "..." : "")
                : msg.content}
            </p>

            {msg.tailoredResume && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> TAILORED RESUME
                </p>
                <pre className="bg-black p-4 rounded-lg text-xs whitespace-pre-wrap max-h-72 overflow-auto border border-gray-800">
                  {msg.tailoredResume}
                </pre>
              </div>
            )}

            {msg.coldEmail && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> COLD EMAIL
                </p>
                <pre className="bg-black p-4 rounded-lg text-xs whitespace-pre-wrap max-h-72 overflow-auto border border-gray-800">
                  {msg.coldEmail}
                </pre>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
            <span
              className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse"
              style={{ animationDelay: "0.3s" }}
            />
            <span className="ml-1">Tailoring your resume...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <div className="flex gap-3 pt-4 mt-2 border-t border-gray-800">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Paste a job description here... (Enter to send, Shift+Enter for new line)"
          rows={3}
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-white text-black px-5 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </main>
  );
}