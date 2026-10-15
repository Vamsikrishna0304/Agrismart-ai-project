import React from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/lib/i18n";

/**
 * Who is signed in right now, with the way in and out. The app runs in public mode, so
 * this reports the account rather than gating anything: records stay readable either way,
 * and signing in is what gives the audit trail a named account to attach actions to.
 */
export default function LoginStatus({ className = "" }) {
  const { t } = useI18n();
  const { user, isAuthenticated, isLoadingAuth, logout, navigateToLogin } = useAuth();

  if (isLoadingAuth) return null;

  if (!isAuthenticated) {
    return (
      <div className={`rounded-xl border border-border bg-muted/60 p-3 ${className}`}>
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <UserRound className="h-3.5 w-3.5 shrink-0" /> {t("Not logged in")}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {t("The app is open in public mode, so records can be read and added without an account.")}
        </p>
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={navigateToLogin}>
          <LogIn className="mr-2 h-3.5 w-3.5" /> {t("Log in")}
        </Button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-muted/60 p-3 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{t("Logged in as")}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{user?.full_name || user?.email}</p>
      {user?.full_name && user?.email ? <p className="truncate text-[11px] text-muted-foreground">{user.email}</p> : null}
      {user?.role ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{t("Role: {role}", { role: t(user.role) })}</p>
      ) : null}
      <Button variant="ghost" size="sm" className="mt-2 w-full justify-start px-2" onClick={() => logout()}>
        <LogOut className="mr-2 h-3.5 w-3.5" /> {t("Log out")}
      </Button>
    </div>
  );
}