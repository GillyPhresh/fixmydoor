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

function getGoogleTranslateElement() {
  return (window as any).google?.translate?.TranslateElement as
    | (new (options: Record<string, unknown>, elementId: string) => unknown)
    | undefined;
}

export default function LanguageTranslator() {
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
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.onerror = () => resolve();
      document.head.appendChild(script);
    }).finally(() => setIsLoading(false));
  }, []);

  const chooseLanguage = async (language: "en" | "fr") => {
    setActiveLanguage(language);

    if (language === "en") {
      clearTranslateCookie();
      if (!triggerGoogleTranslate("en")) {
        window.location.reload();
      }
      return;
    }

    writeTranslateCookie("fr");
    await ensureTranslatorLoaded();
    window.setTimeout(() => {
      if (!triggerGoogleTranslate("fr")) {
        window.location.reload();
      }
    }, 400);
  };

  useEffect(() => {
    if (document.cookie.includes("googtrans=/en/fr")) {
      setActiveLanguage("fr");
      ensureTranslatorLoaded().then(() => {
        window.setTimeout(() => triggerGoogleTranslate("fr"), 500);
      });
    }
  }, [ensureTranslatorLoaded]);

  return (
    <>
      <div id={ELEMENT_ID} className="fixmydoor-translate-element" aria-hidden="true" />
      <div className="fixed bottom-4 left-4 z-[65] rounded-2xl border border-primary/15 bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(47,36,28,0.16)] backdrop-blur">
        <div className="flex items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
            <Globe2 className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={() => chooseLanguage("en")}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${activeLanguage === "en" ? "bg-secondary text-white" : "text-secondary hover:bg-background"}`}
            aria-pressed={activeLanguage === "en"}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => chooseLanguage("fr")}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${activeLanguage === "fr" ? "bg-secondary text-white" : "text-secondary hover:bg-background"}`}
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
