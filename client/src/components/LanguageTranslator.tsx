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

type LanguageTranslatorProps = {
  className?: string;
};

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
      if (!document.querySelector(".goog-te-combo")) {
        return;
      }
      if (!(await waitForGoogleTranslate("en"))) {
        window.location.reload();
      }
      return;
    }

    writeTranslateCookie("fr");
    await ensureTranslatorLoaded();
    if (!(await waitForGoogleTranslate("fr"))) {
      window.location.reload();
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
      ensureTranslatorLoaded().then(() => {
        waitForGoogleTranslate("fr");
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
