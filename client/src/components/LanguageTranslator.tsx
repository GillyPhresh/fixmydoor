import { useCallback, useEffect, useState } from "react";
import { Globe2 } from "lucide-react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
  }
}

const SCRIPT_ID = "fixmydoor-google-translate";
const ELEMENT_ID = "google_translate_element";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const TRANSLATE_RETRY_MS = 150;
const TRANSLATE_RETRY_LIMIT = 24;
const TRANSLATION_BATCH_SIZE = 80;
const textNodeOriginals = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();

type LanguageTranslatorProps = {
  className?: string;
};

type TranslateResponse = {
  success: boolean;
  translations?: string[];
};

const SKIPPED_TRANSLATE_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title"] as const;

function writeTranslateCookie(language: "en" | "fr") {
  const value = language === "fr" ? "/en/fr" : "/en/en";
  document.cookie = `googtrans=${value};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;

  if (window.location.hostname.endsWith("fixmydoor.ca")) {
    document.cookie = `googtrans=${value};domain=.fixmydoor.ca;path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
  }
}

function clearTranslateCookie() {
  document.cookie = "googtrans=;path=/;max-age=0;SameSite=Lax";

  if (window.location.hostname.endsWith("fixmydoor.ca")) {
    document.cookie = "googtrans=;domain=.fixmydoor.ca;path=/;max-age=0;SameSite=Lax";
  }
}

function triggerGoogleTranslate(language: "en" | "fr") {
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!combo) {
    return false;
  }

  combo.value = language;
  combo.dispatchEvent(new Event("change"));
  return true;
}

function waitForGoogleTranslate(language: "en" | "fr") {
  return new Promise<boolean>((resolve) => {
    let attempts = 0;

    const tryTranslate = () => {
      if (triggerGoogleTranslate(language)) {
        resolve(true);
        return;
      }

      attempts += 1;
      if (attempts >= TRANSLATE_RETRY_LIMIT) {
        resolve(false);
        return;
      }

      window.setTimeout(tryTranslate, TRANSLATE_RETRY_MS);
    };

    tryTranslate();
  });
}

function getGoogleTranslateElement() {
  return (window as any).google?.translate?.TranslateElement as
    | (new (options: Record<string, unknown>, elementId: string) => unknown)
    | undefined;
}

function openGoogleTranslateFallback(language: "fr") {
  const translatedUrl = new URL("https://translate.google.com/translate");
  translatedUrl.searchParams.set("sl", "en");
  translatedUrl.searchParams.set("tl", language);
  translatedUrl.searchParams.set("u", window.location.href);
  window.location.href = translatedUrl.toString();
}

function shouldSkipNode(element: Element | null) {
  if (!element) {
    return true;
  }

  if (SKIPPED_TRANSLATE_TAGS.has(element.tagName)) {
    return true;
  }

  return Boolean(
    element.closest(".fixmydoor-translate-element") ||
    element.closest(".goog-te-gadget") ||
    element.closest(".skiptranslate") ||
    element.closest("[data-no-translate]")
  );
}

function collectTextNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const text = node.textContent?.replace(/\s+/g, " ").trim() || "";
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
      const value = element.getAttribute(attribute)?.replace(/\s+/g, " ").trim();
      if (value && value.length > 1) {
        items.push({ element, attribute, value });
      }
    });
  });

  return items;
}

async function requestServerTranslation(texts: string[], targetLanguage: "fr") {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetLanguage, texts }),
  });

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const payload = await response.json() as TranslateResponse;
  if (!payload.success || !Array.isArray(payload.translations)) {
    throw new Error("Translation response was not usable");
  }

  return payload.translations;
}

async function translateInBatches(texts: string[], targetLanguage: "fr") {
  const translations: string[] = [];

  for (let index = 0; index < texts.length; index += TRANSLATION_BATCH_SIZE) {
    const batch = texts.slice(index, index + TRANSLATION_BATCH_SIZE);
    const translatedBatch = await requestServerTranslation(batch, targetLanguage);
    translations.push(...translatedBatch);
  }

  return translations;
}

async function translatePageWithServer(targetLanguage: "fr") {
  const textNodes = collectTextNodes();
  const attributeItems = collectTranslatableAttributes();
  const originals = [
    ...textNodes.map((node) => {
      if (!textNodeOriginals.has(node)) {
        textNodeOriginals.set(node, node.textContent || "");
      }
      return textNodeOriginals.get(node) || "";
    }),
    ...attributeItems.map(({ element, attribute, value }) => {
      const existingMap = attributeOriginals.get(element) || new Map<string, string>();
      if (!existingMap.has(attribute)) {
        existingMap.set(attribute, value);
        attributeOriginals.set(element, existingMap);
      }
      return existingMap.get(attribute) || "";
    }),
  ];

  const translations = await translateInBatches(originals, targetLanguage);
  if (translations.length < originals.length) {
    throw new Error("Translation response was incomplete");
  }

  textNodes.forEach((node, index) => {
    node.textContent = translations[index] || node.textContent;
  });

  attributeItems.forEach(({ element, attribute }, index) => {
    element.setAttribute(attribute, translations[textNodes.length + index] || element.getAttribute(attribute) || "");
  });
}

function restoreOriginalPageText() {
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

  const ensureTranslatorLoaded = useCallback(() => {
    if (getGoogleTranslateElement()) {
      return Promise.resolve();
    }

    setIsLoading(true);

    return new Promise<void>((resolve) => {
      window.googleTranslateElementInit = () => {
        if (!document.getElementById(ELEMENT_ID)) {
          resolve();
          return;
        }

        const TranslateElement = getGoogleTranslateElement();
        if (TranslateElement) {
          new TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,fr",
              autoDisplay: false,
            },
            ELEMENT_ID,
          );
        }
        resolve();
      };

      if (document.getElementById(SCRIPT_ID)) {
        window.googleTranslateElementInit?.();
        return;
      }

      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.onerror = () => resolve();
      document.head.appendChild(script);
    }).finally(() => setIsLoading(false));
  }, []);

  const chooseLanguage = async (language: "en" | "fr") => {
    setActiveLanguage(language);

    if (language === "en") {
      clearTranslateCookie();
      restoreOriginalPageText();
      if (!document.querySelector(".goog-te-combo")) {
        return;
      }
      if (!(await waitForGoogleTranslate("en"))) {
        window.location.reload();
      }
      return;
    }

    writeTranslateCookie("fr");
    try {
      setIsLoading(true);
      await translatePageWithServer("fr");
      return;
    } catch (error) {
      console.error("Server-side translation failed; falling back to Google widget.", error);
    } finally {
      setIsLoading(false);
    }

    await ensureTranslatorLoaded();
    if (!(await waitForGoogleTranslate("fr"))) {
      openGoogleTranslateFallback("fr");
    }
  };

  useEffect(() => {
    const loadTranslator = () => {
      ensureTranslatorLoaded();
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(loadTranslator, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(loadTranslator, 1200);
    return () => globalThis.clearTimeout(timeoutId);
  }, [ensureTranslatorLoaded]);

  useEffect(() => {
    if (document.cookie.includes("googtrans=/en/fr")) {
      setActiveLanguage("fr");
      translatePageWithServer("fr").catch(() => {
        ensureTranslatorLoaded().then(() => {
          waitForGoogleTranslate("fr");
        });
      });
    }
  }, [ensureTranslatorLoaded]);

  return (
    <>
      <div id={ELEMENT_ID} className="fixmydoor-translate-element" aria-hidden="true" />
      <div className={`inline-flex shrink-0 rounded-2xl border border-primary/15 bg-white/90 p-1 shadow-[0_10px_24px_rgba(47,36,28,0.10)] backdrop-blur ${className}`}>
        <div className="flex items-center gap-0.5">
          <span className="hidden h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex" aria-hidden="true">
            <Globe2 className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={() => chooseLanguage("en")}
            className={`rounded-xl px-2.5 py-2 text-[0.7rem] font-bold leading-none transition sm:px-3 sm:text-xs ${activeLanguage === "en" ? "bg-secondary text-white" : "text-secondary hover:bg-background"}`}
            aria-pressed={activeLanguage === "en"}
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
    </>
  );
}
