import React from "react";
import { Waves } from "lucide-react";
import Brand from "@/components/layout/Brand";
import NavLinkItem from "@/components/layout/NavLinkItem";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import LoginStatus from "@/components/layout/LoginStatus";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav";
import { useI18n } from "@/lib/i18n";

export function NavGroups({ onNavigate }) {
  const { t } = useI18n();

  return (
    <nav className="flex-1 space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{t(group)}</p>
          <div className="space-y-1">
            {NAV_ITEMS.filter((item) => item.group === group).map(({ to, label, Icon }) => (
              <NavLinkItem key={to} to={to} label={label} Icon={Icon} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const { t } = useI18n();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col overflow-y-auto border-r border-border bg-card px-4 py-6 lg:flex">
      <Brand />
      <LanguageSwitcher className="mt-5" />
      <div className="mt-6 flex flex-1 flex-col">
        <NavGroups />
      </div>
      <LoginStatus className="mt-6" />
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
        <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("Every value is labelled: measured, model output, rule engine, or simulated.")}
      </p>
    </aside>
  );
}
