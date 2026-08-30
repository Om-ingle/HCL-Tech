"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, MessageCircle, Sparkles, Cpu } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Button, cx } from "./ui";

interface Msg {
  role: "user" | "assistant";
  text: string;
  source?: "llm" | "fallback";
  provider?: string;
  note?: string;
}

const SUGGESTIONS = [
  "Why is this my next step?",
  "How long until I'm job-ready?",
  "What are my biggest gaps?",
  "What if a topic is too easy?",
];

export function Assistant() {
  const { assistantOpen, setAssistantOpen, profileId } = useAppStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    // Short-term memory only: the last 3 turns, so follow-ups like "why?" or
    // "can I skip it?" make sense without re-sending the whole chat (cost).
    const history = messages.slice(-3).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api.assistant(profileId, question, history);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: r.text, source: r.source, provider: r.provider, note: r.note },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong.", source: "fallback" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!assistantOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={() => setAssistantOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-raised shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-route-soft text-route">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold leading-tight">Navigator Assistant</p>
              <p className="text-xs text-muted">Grounded in your route & gaps</p>
            </div>
          </div>
          <button onClick={() => setAssistantOpen(false)} className="rounded-full p-1 text-muted hover:bg-line/50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="rounded-xl bg-surface p-3 text-sm text-muted">
              Ask me anything about your path — why a step is recommended, your timeline, or what to do next.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "bg-route text-white" : "border border-line bg-surface text-ink",
                )}
              >
                {m.text}
                {m.role === "assistant" && m.source && (
                  <div className="mt-1 text-[10px] text-faint">
                    <div className="flex items-center gap-1">
                      {m.source === "llm" ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                      {m.source === "llm" ? `AI: ${m.provider ?? "configured model"}` : "Fallback"}
                    </div>
                    {m.note && <div className="mt-0.5 opacity-80">{m.note}</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-muted">Thinking…</div>}
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:border-route/40 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-line p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the Navigator…"
            className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-route"
          />
          <Button type="submit" loading={busy} className="!px-3">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
