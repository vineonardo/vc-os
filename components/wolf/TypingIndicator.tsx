"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="Wolf is typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2 w-2 animate-pulse rounded-full bg-gold"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}
