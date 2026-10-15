import React from "react";
import { Bot, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ChatBubble({ message }) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const failed = message.response_source === "error";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </span>
      ) : null}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : failed
              ? "border border-red-200 bg-red-50 text-red-900"
              : "border border-border bg-card text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && !failed && message.context_used ? (
          <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
            {t("Farm records used: {context}", { context: message.context_used })}
          </p>
        ) : null}
        {!isUser && message.sources_note ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{message.sources_note}</p>
        ) : null}
      </div>

      {isUser ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}