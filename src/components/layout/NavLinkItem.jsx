import React from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

export default function NavLinkItem({ to, label, Icon, onNavigate }) {
  const { t } = useI18n();

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{t(label)}</span>
    </NavLink>
  );
}
