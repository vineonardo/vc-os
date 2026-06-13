import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="grid h-9 w-9 shrink-0 place-items-center border border-gold/30 bg-gold/10 text-gold">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] border px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[68%]",
          isUser
            ? "border-gold/25 bg-gold text-blackwolf"
            : "border-white/10 bg-card text-text",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.credits_used > 0 && (
          <div className="mt-2 text-xs text-muted">
            {message.credits_used} {message.credits_used === 1 ? "credit" : "credits"} used
          </div>
        )}
      </div>
      {isUser && (
        <div className="grid h-9 w-9 shrink-0 place-items-center border border-white/10 bg-surface text-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
