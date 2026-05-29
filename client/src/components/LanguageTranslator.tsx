import { useEffect, useRef, useState } from "react";
import { Globe2 } from "lucide-react";

const LANGUAGE_STORAGE_KEY = "fixmydoor-language";
const textNodeOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
const localeCache = new Map<"en" | "fr", Record<string, string>>();
const phraseCache = new WeakMap<Record<string, string>, string[]>();

type LanguageTranslatorProps = {
  className?: string;
};

const SKIPPED_TRANSLATE_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title"] as const;
const FALLBACK_FR_TERMS: Array<[RegExp, string]> = [
  [/\bdoor repairs?\b/gi, "reparations de portes"],
  [/\bdoor installations?\b/gi, "installations de portes"],
  [/\bfurniture repairs?\b/gi, "reparations de meubles"],
  [/\bfurniture installations?\b/gi, "installations de meubles"],
  [/\bhardware sourcing\b/gi, "recherche de quincaillerie"],
  [/\bentry door\b/gi, "porte d'entree"],
  [/\bfront door\b/gi, "porte d'entree"],
  [/\binterior door\b/gi, "porte interieure"],
  [/\bcustomer requests?\b/gi, "demandes des clients"],
  [/\binternational requests?\b/gi, "demandes internationales"],
  [/\bmeasurements?\b/gi, "mesures"],
  [/\bphotos?\b/gi, "photos"],
  [/\bhandles?\b/gi, "poignees"],
  [/\blocks?\b/gi, "serrures"],
  [/\bhinges?\b/gi, "charnieres"],
  [/\bcabinets?\b/gi, "armoires"],
  [/\bdrawers?\b/gi, "tiroirs"],
  [/\brepairs?\b/gi, "reparations"],
  [/\binstallations?\b/gi, "installations"],
  [/\bhardware\b/gi, "quincaillerie"],
  [/\bfurniture\b/gi, "meubles"],
  [/\bdoors?\b/gi, "portes"],
  [/\bservice\b/gi, "service"],
  [/\bservices\b/gi, "services"],
  [/\brequest\b/gi, "demande"],
  [/\brequests\b/gi, "demandes"],
  [/\bcontact\b/gi, "contact"],
  [/\bcall\b/gi, "appeler"],
  [/\bsend\b/gi, "envoyer"],
  [/\bbuy\b/gi, "acheter"],
  [/\bsource\b/gi, "trouver"],
  [/\bCanada\b/g, "Canada"],
  [/\bMontreal\b/g, "Montreal"],
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldSkipNode(element: Element | null) {
  if (!element) {
    return true;
  }

  if (SKIPPED_TRANSLATE_TAGS.has(element.tagName)) {
    return true;
  }

  return Boolean(
    element.closest("[data-no-translate]") ||
    element.closest(".fixmydoor-language-switcher")
  );
}

function collectTextNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const text = normalizeText(node.textContent || "");
      if (text.length < 2 || shouldSkipNode(parent)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    nodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  return nodes;
}

function collectTranslatableAttributes() {
  const items: Array<{ element: Element; attribute: (typeof TRANSLATABLE_ATTRIBUTES)[number]; value: string }> = [];
  document.querySelectorAll<HTMLElement>("input, textarea, button, a, img, [aria-label], [title]").forEach((element) => {
    if (shouldSkipNode(element)) {
      return;
    }

    TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
      const value = normalizeText(element.getAttribute(attribute) || "");
      if (value.length > 1) {
        items.push({ element, attribute, value });
      }
    });
  });

  return items;
}

async function loadLocale(language: "en" | "fr") {
  const cachedLocale = localeCache.get(language);
  if (cachedLocale) {
    return cachedLocale;
  }

  const response = await fetch(`/locales/${language}.json?v=2`, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load ${language} language file`);
  }

  const locale = await response.json() as Record<string, string>;
  localeCache.set(language, locale);
  return locale;
}

function translateValue(value: string, locale: Record<string, string>) {
  const normalized = normalizeText(value);
  const exactTranslation = locale[value] || locale[normalized];
  if (exactTranslation) {
    return exactTranslation;
  }

  let translated = normalized;
  const phraseKeys = phraseCache.get(locale) || Object.keys(locale)
    .filter((key) => key.length > 3 && key.length < 160)
    .sort((a, b) => b.length - a.length);

  if (!phraseCache.has(locale)) {
    phraseCache.set(locale, phraseKeys);
  }

  phraseKeys.forEach((key) => {
    const phrasePattern = new RegExp(escapeRegExp(key), "gi");
    if (phrasePattern.test(translated)) {
      translated = translated.replace(phrasePattern, locale[key]);
    }
  });

  if (translated !== normalized) {
    return translated;
  }

  FALLBACK_FR_TERMS.forEach(([pattern, replacement]) => {
    translated = translated.replace(pattern, replacement);
  });

  return translated !== normalized ? translated : value;
}

function applyLocale(locale: Record<string, string>) {
  collectTextNodes().forEach((node) => {
    if (!textNodeOriginals.has(node)) {
      textNodeOriginals.set(node, node.textContent || "");
    }

    const original = textNodeOriginals.get(node) || "";
    const translated = translateValue(original, locale);
    if (node.textContent !== translated) {
      node.textContent = translated;
    }
  });

  collectTranslatableAttributes().forEach(({ element, attribute, value }) => {
    const existingMap = attributeOriginals.get(element) || new Map<string, string>();
    if (!existingMap.has(attribute)) {
      existingMap.set(attribute, value);
      attributeOriginals.set(element, existingMap);
    }

    const original = existingMap.get(attribute) || value;
    const translated = translateValue(original, locale);
    if (element.getAttribute(attribute) !== translated) {
      element.setAttribute(attribute, translated);
    }
  });
}

function restoreEnglishText() {
  collectTextNodes().forEach((node) => {
    const original = textNodeOriginals.get(node);
    if (original) {
      node.textContent = original;
    }
  });

  document.querySelectorAll<HTMLElement>("input, textarea, button, a, img, [aria-label], [title]").forEach((element) => {
    const originalAttributes = attributeOriginals.get(element);
    if (!originalAttributes) {
      return;
    }

    originalAttributes.forEach((value, attribute) => {
      element.setAttribute(attribute, value);
    });
  });
}

export default function LanguageTranslator({ className = "" }: LanguageTranslatorProps) {
  const [activeLanguage, setActiveLanguage] = useState<"en" | "fr">("en");
  const [isLoading, setIsLoading] = useState(false);
  const activeLocaleRef = useRef<Record<string, string> | null>(null);
  const observerTimeoutRef = useRef<number | null>(null);

  const chooseLanguage = async (language: "en" | "fr") => {
    setActiveLanguage(language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

    if (language === "en") {
      activeLocaleRef.current = null;
      restoreEnglishText();
      document.documentElement.lang = "en";
      return;
    }

    try {
      setIsLoading(true);
      const locale = await loadLocale("fr");
      activeLocaleRef.current = locale;
      applyLocale(locale);
      document.documentElement.lang = "fr";
    } catch (error) {
      console.error("Unable to load the French language file.", error);
      activeLocaleRef.current = null;
      setActiveLanguage("en");
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
    const savedLanguage = requestedLanguage === "fr" ? "fr" : window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage === "fr") {
      chooseLanguage("fr");
    }
  }, []);

  useEffect(() => {
    if (activeLanguage !== "fr") {
      activeLocaleRef.current = null;
      return;
    }

    const observer = new MutationObserver(() => {
      if (observerTimeoutRef.current) {
        window.clearTimeout(observerTimeoutRef.current);
      }

      observerTimeoutRef.current = window.setTimeout(() => {
        const locale = activeLocaleRef.current;
        if (locale) {
          applyLocale(locale);
        }
      }, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (observerTimeoutRef.current) {
        window.clearTimeout(observerTimeoutRef.current);
      }
    };
  }, [activeLanguage]);

  return (
    <div className={`fixmydoor-language-switcher inline-flex shrink-0 rounded-2xl border border-primary/15 bg-white/90 p-1 shadow-[0_10px_24px_rgba(47,36,28,0.10)] backdrop-blur ${className}`} data-no-translate="true">
      <div className="flex items-center gap-0.5">
        <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex" aria-hidden="true">
          <Globe2 className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => chooseLanguage("en")}
          className={`rounded-xl px-2.5 py-2 text-[0.7rem] font-bold leading-none transition sm:px-3 sm:text-xs ${activeLanguage === "en" ? "bg-secondary text-white" : "text-secondary hover:bg-background"}`}
          aria-pressed={activeLanguage === "en"}
          disabled={isLoading}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => chooseLanguage("fr")}
          className={`rounded-xl px-2.5 py-2 text-[0.7rem] font-bold leading-none transition sm:px-3 sm:text-xs ${activeLanguage === "fr" ? "bg-secondary text-white" : "text-secondary hover:bg-background"}`}
          aria-pressed={activeLanguage === "fr"}
          disabled={isLoading}
        >
          FR
        </button>
      </div>
    </div>
  );
}
