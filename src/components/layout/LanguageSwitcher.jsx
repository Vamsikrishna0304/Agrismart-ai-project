import React from "react";
import { LANGUAGES, useI18n } from "@/lib/i18n";

export default function LanguageSwitcher({ showLabel = true, className = "" }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel ? (
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">{t("Language")}</span>
      ) : null}
      <div
        role="group"
        aria-label={t("Interface language")}
        className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
      >
        {LANGUAGES.map((option) => {
          const active = lang === option.code;
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => setLang(option.code)}
              aria-pressed={active}
              title={option.label}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
