"use client";

import { ArrowUp, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { CREDIT_COSTS } from "@/lib/constants";
import type { ChatMessage } from "@/types";
import { CreditBadge } from "@/components/wolf/CreditBadge";
import { MessageBubble } from "@/components/wolf/Message";
import { TypingIndicator } from "@/components/wolf/TypingIndicator";

type StreamEvent = {
  delta?: string;
  credits?: number;
  error?: string;
};

const toolChips = [
  {
    label: "Pitch deck",
    cost: CREDIT_COSTS.PITCH_DECK,
    href: "/api/generate/pitch-deck",
    icon: Presentation,
  },
  {
    label: "Financial model",
    cost: CREDIT_COSTS.FINANCIAL_MODEL,
    href: "/api/generate/financial-model",
    icon: FileSpreadsheet,
  },
  {
    label: "Investor memo",
    cost: CREDIT_COSTS.INVESTOR_MEMO,
    href: "/api/generate/investor-memo",
    icon: FileText,
  },
];

export function ChatWindow({
  userId,
  conversationId,
  initialMessages,
  initialCredits,
}: {
  userId: string;
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialCredits: number;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [credits, setCredits] = useState(initialCredits);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [assetStatus, setAssetStatus] = useState<string | null>(null);
  const assistantMessageId = useRef<string | null>(null);

  const showTools = useMemo(
    () => messages.filter((message) => message.role === "assistant").length >= 5,
    [messages],
  );

  async function parseStream(response: Response) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream.");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;

        const payload = JSON.parse(dataLine.slice(6)) as StreamEvent;
        if (payload.error) throw new Error(payload.error);
        if (typeof payload.credits === "number") setCredits(payload.credits);
        if (payload.delta && assistantMessageId.current) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId.current
                ? { ...message, content: message.content + payload.delta }
                : message,
            ),
          );
        }
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      credits_used: 0,
      created_at: new Date().toISOString(),
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      credits_used: CREDIT_COSTS.CHAT_MESSAGE,
      created_at: new Date().toISOString(),
    };

    assistantMessageId.current = assistantMessage.id;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Wolf could not respond.");
      }

      await parseStream(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wolf could not respond.";
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: message, credits_used: 0 }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
      assistantMessageId.current = null;
    }
  }

  async function generateAsset(href: string, label: string) {
    setAssetStatus(`Generating ${label.toLowerCase()}...`);

    try {
      const response = await fetch(href, { method: "POST" });
      const payload = (await response.json()) as { downloadUrl?: string; credits?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || `Could not generate ${label}.`);
      if (typeof payload.credits === "number") setCredits(payload.credits);
      setAssetStatus(`${label} ready.`);
      if (payload.downloadUrl) window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : `Could not generate ${label}.`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-blackwolf text-text">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-blackwolf/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-gold/40 bg-gold/10 font-heading text-lg font-bold text-gold">
              W
            </div>
            <div>
              <div className="font-heading text-base font-semibold">Wolf by Venture Wolf</div>
              <div className="text-xs text-muted">Private founder screening assistant</div>
            </div>
          </div>
          <CreditBadge userId={userId} initialBalance={credits} />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-8">
        <div className="flex-1 space-y-5 overflow-y-auto pb-5">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isStreaming && (
            <div className="ml-12">
              <TypingIndicator />
            </div>
          )}
        </div>

        {showTools && (
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            {toolChips.map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => generateAsset(tool.href, tool.label)}
                className="flex items-center justify-between border border-gold/20 bg-card px-4 py-3 text-left text-sm transition hover:border-gold/60"
              >
                <span className="flex items-center gap-2">
                  <tool.icon className="h-4 w-4 text-gold" />
                  {tool.label}
                </span>
                <span className="text-gold">{tool.cost} credits</span>
              </button>
            ))}
          </div>
        )}

        {assetStatus && <div className="mb-4 text-sm text-muted">{assetStatus}</div>}

        <form onSubmit={handleSubmit} className="flex gap-3 border border-white/10 bg-surface p-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Continue your conversation"
            className="min-h-12 flex-1 bg-transparent px-3 text-sm text-text outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="grid h-12 w-12 place-items-center bg-gold text-blackwolf transition hover:bg-[#ffd45d] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </section>
    </main>
  );
}
