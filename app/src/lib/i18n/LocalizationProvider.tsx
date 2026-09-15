import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { blocksClient } from "../blocks/client";
import { defaultDictionary } from "./dictionary";
import type { TranslationKey } from "./dictionary";
import { bengaliDictionary, germanDictionary } from "./locales";

type Dictionary = Record<string, string>;
export type LocalizationLanguage = { code: string; isDefault: boolean; name: string };
type LocalizationValue = {
  language: string;
  languages: LocalizationLanguage[];
  setLanguage: (language: string) => void;
  t: (key: TranslationKey, fallback?: string, params?: Record<string, string>) => string;
};

const LocalizationContext = createContext<LocalizationValue | undefined>(undefined);
const LANGUAGE_KEY = "blocks-app:language";
// This project's published common bundle contains all application keys.
const MODULES = ["common"];
const FALLBACK_LANGUAGES = [
  { code: "en-US", name: "English", isDefault: true },
  { code: "bn-BD", name: "বাংলা", isDefault: false },
  { code: "de-DE", name: "Deutsch", isDefault: false }
];

function normalizeLanguage(raw: Record<string, unknown>): LocalizationLanguage {
  const code = raw.languageCode ?? raw.code ?? raw.culture ?? "en";
  const name = raw.languageName ?? raw.displayName ?? raw.name ?? String(code);
  return { code: String(code), isDefault: Boolean(raw.isDefault), name: String(name) };
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [languageOverride, setLanguageOverride] = useState(() => {
    try { const saved = localStorage.getItem(LANGUAGE_KEY); return saved === "en" ? "en-US" : saved ?? ""; } catch { return ""; }
  });

  const languagesQuery = useQuery({
    queryFn: () => blocksClient.localization.languages(),
    queryKey: ["i18n", "languages"],
    staleTime: 5 * 60_000
  });

  const languages = useMemo(() => {
    const remote = (Array.isArray(languagesQuery.data) ? languagesQuery.data : []).map(normalizeLanguage);
    return FALLBACK_LANGUAGES.map(entry => ({ ...entry, isDefault: remote.find(item => item.code === entry.code)?.isDefault ?? entry.isDefault }));
  }, [languagesQuery.data]);
  // Until /Language/Gets resolves (or on a tenant with none configured), fall
  // back to "en" -- it must still match a real languageCode for translations
  // to resolve, so this is a startup default rather than a guaranteed hit.
  const defaultLanguage = languages.find((entry) => entry.isDefault)?.code ?? languages[0]?.code ?? "en";
  const language = languages.some(entry => entry.code === languageOverride) ? languageOverride : defaultLanguage;
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = "ltr"; }, [language]);

  function setLanguage(next: string) {
    if (!languages.some(entry => entry.code === next)) return;
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Storage may be unavailable in private browsing. */ }
    setLanguageOverride(next);
  }

  // One cached query per module for the active language -- TanStack Query
  // dedupes/caches by queryKey, so switching languages (or remounting) never
  // re-fetches a (language, module) pair that's already in cache.
  const moduleQueries = useQueries({
    queries: MODULES.map((moduleName) => ({
      queryFn: () => blocksClient.localization.translations(moduleName, language),
      queryKey: ["i18n", "translations", language, moduleName],
      staleTime: 5 * 60_000
    }))
  });

  const cloudDictionary = useMemo<Dictionary>(() => {
    const merged: Dictionary = {};
    moduleQueries.forEach((query, index) => {
      const moduleName = MODULES[index];
      for (const [key, value] of Object.entries(query.data ?? {})) {
        const appKey = moduleName === "common" && key in defaultDictionary ? key : `${moduleName}.${key}`;
        if (typeof value === "string" && value.trim() && !value.includes("KEY MISSING")) merged[appKey] = value;
      }
    });
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleQueries.map((query) => query.dataUpdatedAt).join()]);

  const value = useMemo<LocalizationValue>(() => ({
    language,
    languages,
    setLanguage,
    t: (key, fallback, params) => {
      const local = language.startsWith("bn") ? bengaliDictionary : language.startsWith("de") ? germanDictionary : defaultDictionary;
      // Keep the approved brand consistent while older cloud bundles are cached.
      const name = local["app.name"] ?? defaultDictionary["app.name"];
      const raw = key === "app.name" ? name : (cloudDictionary[key] ?? local[key] ?? defaultDictionary[key] ?? fallback ?? key).replaceAll("ChikitsaFollow", name);
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
    }
  }), [cloudDictionary, language, languages]);

  useEffect(() => {
    const name = value.t("app.name");
    document.title = name;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", name);
  }, [value]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useT() {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error("useT must be used within LocalizationProvider");
  return context;
}

// `t()` accepts `TranslationKey` literally, but we sometimes need to
// compose keys from runtime data (e.g. `cases.category.${row.Category}`).
// Cast to `TranslationKey` at the call site; this helper makes that
// single cast type-safe and greppable.
export function tx(value: string): TranslationKey {
  return value as TranslationKey;
}
