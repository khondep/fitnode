"use client";

import { useState } from "react";

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
        { role: "assistant", content: `Error: ${data.error}` },
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
    <main className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">
      <h1 className="text-2xl font-bold mb-1">Tailor Chat</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Paste a job description to get a tailored resume and cold email.
      </p>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm">
            Paste a full job description below to get started.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-4 ${
              msg.role === "user"
                ? "bg-gray-900 border border-gray-800"
                : "bg-gray-950 border border-gray-800"
            }`}
          >
            <p className="text-sm text-gray-400 mb-1">
              {msg.role === "user" ? "You pasted:" : "FitNode"}
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {msg.role === "user" ? msg.content.slice(0, 300) + (msg.content.length > 300 ? "..." : "") : msg.content}
            </p>

            {msg.tailoredResume && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-400 mb-1">TAILORED RESUME</p>
                <pre className="bg-black p-3 rounded text-xs whitespace-pre-wrap max-h-64 overflow-auto">
                  {msg.tailoredResume}
                </pre>
              </div>
            )}

            {msg.coldEmail && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-400 mb-1">COLD EMAIL</p>
                <pre className="bg-black p-3 rounded text-xs whitespace-pre-wrap max-h-64 overflow-auto">
                  {msg.coldEmail}
                </pre>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-sm text-gray-500">Tailoring your resume...</div>
        )}
      </div>

      <div className="flex gap-2 pb-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a job description here..."
          rows={4}
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm resize-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 self-end"
        >
          Send
        </button>
      </div>
    </main>
  );
}