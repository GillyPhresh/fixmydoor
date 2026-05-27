import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";

const LANGUAGE_STORAGE_KEY = "fixmydoor-language";
const textNodeOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
const localeCache = new Map<"en" | "fr", Record<string, string>>();

type LanguageTranslatorProps = {
  className?: string;
};

const SKIPPED_TRANSLATE_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title"] as const;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

  const response = await fetch(`/locales/${language}.json`, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load ${language} language file`);
  }

  const locale = await response.json() as Record<string, string>;
  localeCache.set(language, locale);
  return locale;
}

function translateValue(value: string, locale: Record<string, string>) {
  const normalized = normalizeText(value);
  return locale[value] || locale[normalized] || value;
}

function applyLocale(locale: Record<string, string>) {
  collectTextNodes().forEach((node) => {
    if (!textNodeOriginals.has(node)) {
      textNodeOriginals.set(node, node.textContent || "");
    }

    const original = textNodeOriginals.get(node) || "";
    node.textContent = translateValue(original, locale);
  });

  collectTranslatableAttributes().forEach(({ element, attribute, value }) => {
    const existingMap = attributeOriginals.get(element) || new Map<string, string>();
    if (!existingMap.has(attribute)) {
      existingMap.set(attribute, value);
      attributeOriginals.set(element, existingMap);
    }

    const original = existingMap.get(attribute) || value;
    element.setAttribute(attribute, translateValue(original, locale));
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

  const chooseLanguage = async (language: "en" | "fr") => {
    setActiveLanguage(language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

    if (language === "en") {
      restoreEnglishText();
      document.documentElement.lang = "en";
      return;
    }

    try {
      setIsLoading(true);
      const locale = await loadLocale("fr");
      applyLocale(locale);
      document.documentElement.lang = "fr";
    } catch (error) {
      console.error("Unable to load the French language file.", error);
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
