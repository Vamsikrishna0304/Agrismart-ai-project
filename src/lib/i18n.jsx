import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TE } from "@/lib/locales/te";

/**
 * Lightweight bilingual layer (English ⇄ Telugu).
 *
 * English is the source language: the app's own strings ARE the keys. `t("Farms")`
 * returns "Farms" in English and the Telugu entry in Telugu, falling back to the
 * English string when a translation is missing — so a screen that has not been
 * translated yet stays readable instead of breaking.
 *
 * Values stored in records (crop names, notes, alert text written by the backend)
 * are shown exactly as stored; only the app's own interface text is translated.
 */

const STORAGE_KEY = "agrismart.language";

export const LANGUAGES = [
  { code: "en", short: "EN", label: "English" },
  { code: "te", short: "తె", label: "తెలుగు" },
];

export const LOCALES = { en: "en-IN", te: "te-IN" };

let activeLang = "en";

export function getLang() {
  return activeLang;
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] === undefined || params[key] === null ? "" : String(params[key])
  );
}

/** Translate outside React (helpers such as freshnessLabel). */
export function tr(text, params) {
  if (text === null || text === undefined) return "";
  const source = String(text);
  const template = activeLang === "en" ? source : TE[source] || source;
  return interpolate(template, params);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return stored === "te" || stored === "en" ? stored : "en";
  });

  activeLang = lang;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (next !== "en" && next !== "te") return;
    activeLang = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback((text, params) => tr(text, params), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return { lang: activeLang, setLang: () => {}, t: tr };
  }
  return context;
}