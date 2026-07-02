import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/types";
import { stripCreditBalanceCopy } from "@/lib/credit-copy";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const content = isUser ? message.content : stripCreditBalanceCopy(message.content);

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
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
      {isUser && (
        <div className="grid h-9 w-9 shrink-0 place-items-center border border-white/10 bg-surface text-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
