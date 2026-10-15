import React, { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Send, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import FarmSelect from "@/components/common/FarmSelect";
import ChatBubble from "@/components/assistant/ChatBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SUGGESTED_QUESTIONS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const CONVERSATION_KEY = "agrismart_conversation_id";

function readConversationId() {
  const existing = window.localStorage.getItem(CONVERSATION_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(CONVERSATION_KEY, created);
  return created;
}

export default function Assistant() {
  const { t } = useI18n();
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [conversationId, setConversationId] = useState(readConversationId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  async function loadMessages(id) {
    const page = await base44.entities.AssistantMessage.filter(
      { conversation_id: id },
      { sort: "created_date", limit: 60 }
    );
    setMessages(page.items || []);
    setLoading(false);
  }

  useEffect(() => {
    base44.entities.Farm.filter({}, { sort: "name", limit: 100 }).then((page) => {
      const items = page.items || [];
      setFarms(items);
      setFarmId(items[0] ? items[0].id : "");
    });
  }, []);

  useEffect(() => {
    loadMessages(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text) {
    const question = (text || input).trim();
    if (!question || sending) return;
    setSending(true);
    setError(null);
    setInput("");

    const optimistic = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: question,
      response_source: "live_model",
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await base44.functions.invoke("assistantChat", {
        conversation_id: conversationId,
        farm_id: farmId,
        message: question,
      });
      const data = response.data || {};
      if (data.status !== "ok") setError(data.error || t("The assistant could not answer."));
      await loadMessages(conversationId);
    } catch (err) {
      setError(err.message);
      await loadMessages(conversationId);
    } finally {
      setSending(false);
    }
  }

  function startNewConversation() {
    const next = window.crypto.randomUUID();
    window.localStorage.setItem(CONVERSATION_KEY, next);
    setConversationId(next);
    setMessages([]);
    setError(null);
  }

  return (
    <div>
      <PageHeader
        title={t("Agriculture assistant")}
        description={t(
          "Ask about crop choice, soil preparation, irrigation, growth stages, pest symptoms or weather precautions. Answers use the farm records you select."
        )}
        badge={<ProvenanceBadge kind="modelled" label={t("Generated live")} />}
        actions={
          <Button variant="outline" onClick={startNewConversation}>
            <MessageSquarePlus className="mr-2 h-4 w-4" /> {t("New conversation")}
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="assistant-farm">
            {t("Farm context")}
          </label>
          <FarmSelect id="assistant-farm" farms={farms} value={farmId} onChange={setFarmId} placeholder={t("No farm context")} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "With a farm selected, the assistant is given its crops, latest soil sample, recent readings and last irrigation decision. Sensor values marked simulated are passed on as simulated."
            )}
          </p>
        </div>

        <div className="min-h-[320px] space-y-4 rounded-2xl border border-border bg-muted/30 p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((key) => (
                <div key={key} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : messages.length ? (
            messages.map((message) => <ChatBubble key={message.id} message={message} />)
          ) : (
            <div className="py-6 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                {t("Nothing asked yet. Try one of these, or type your own question.")}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => send(t(question))}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    {t(question)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> {t("Generating an answer from your records…")}
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>{t("No answer was generated")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <Textarea
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={t("Ask about your crop, soil, irrigation, pests or weather precautions…")}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "No document library is connected, so answers come from the model's general knowledge and your records. Nothing is presented as a citation, and chemical dosages are never given."
              )}
            </p>
            <Button type="submit" disabled={sending || !input.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? t("Sending…") : t("Send")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}