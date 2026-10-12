import React from "react";
import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Brand({ compact = false }) {
  const { t } = useI18n();

  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sprout className="h-5 w-5" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block font-display text-base font-semibold tracking-tight text-foreground">AgriSmart AI</span>
          <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t("Farm intelligence")}</span>
        </span>
      ) : null}
    </Link>
  );
}
