import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Pill from "@/components/common/Pill";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export default function DigestCard() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function sendDigest() {
    setSending(true);
    try {
      const response = await base44.functions.invoke("sendFarmDigest", {});
      const data = response.data || {};

      if (data.status === "sent") {
        setResult(data);
        toast({
          title: t("Digest sent"),
          description: t("{farms} farms, {readings} readings, {alerts} open alerts — sent to {recipients}", {
            farms: data.farms,
            readings: data.readings,
            alerts: data.open_alerts,
            recipients: (data.recipients || []).join(", "),
          }),
        });
        return;
      }

      if (data.status === "nothing_to_send") {
        toast({
          variant: "destructive",
          title: t("Add a farm first"),
          description: t("A digest lists a farm's newest readings and open alerts, so at least one farm is needed."),
        });
        return;
      }

      if (data.status === "no_recipients") {
        toast({
          variant: "destructive",
          title: t("No administrator email to send to"),
          description: t("The digest goes to the app's registered administrators. Add one from the app dashboard, then try again."),
        });
        return;
      }

      toast({
        variant: "destructive",
        title: t("The digest could not be sent"),
        description: data.error || data.status,
      });
    } catch (error) {
      const payload = error && error.response ? error.response.data : null;
      toast({
        variant: "destructive",
        title: t("The digest could not be sent"),
        description: (payload && payload.error) || error.message,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Mail className="h-4 w-4" /> {t("Daily summary by email")}
        </h2>
        <Pill tone="neutral">{t("On demand")}</Pill>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t(
          "Each farm's newest sensor readings and its open alerts, in one email to the app's registered administrators. Every reading says where it came from, so a simulated value is never mistaken for a measurement."
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={sendDigest} disabled={sending}>
          <Send className="mr-2 h-3.5 w-3.5" />
          {sending ? t("Sending the summary…") : t("Send today's digest now")}
        </Button>
        {result ? (
          <span className="text-xs text-muted-foreground">
            {t("Last sent {date} to {emails}", {
              date: formatDateTime(result.sent_at),
              emails: (result.recipients || []).join(", "),
            })}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {t(
          "Sending automatically at 7:00 AM every morning needs a scheduled task, which the Builder plan includes and the current plan does not. Until that is switched on, send the digest from here."
        )}
      </p>
    </section>
  );
}