import React from "react";
import { Menu, X } from "lucide-react";
import Brand from "@/components/layout/Brand";
import { NavGroups } from "@/components/layout/Sidebar";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import LoginStatus from "@/components/layout/LoginStatus";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function MobileNav({ open, onOpen, onClose }) {
  const { t } = useI18n();

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-2">
          <LanguageSwitcher showLabel={false} />
          <Button variant="ghost" size="icon" onClick={onOpen} aria-label={t("Open navigation")}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("Close navigation")}
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 flex w-[282px] flex-col overflow-y-auto border-r border-border bg-card px-4 py-5">
            <div className="flex items-center justify-between">
              <Brand />
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("Close navigation")}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-6 flex flex-1 flex-col">
              <NavGroups onNavigate={onClose} />
            </div>
            <LoginStatus className="mt-4" />
          </div>
        </div>
      ) : null}
    </>
  );
}
