import { useEffect, useState } from "react";

const storageKey = "fixmydoor-language";
const changeEvent = "fixmydoor-language-change";
type Language = "en" | "fr";

function readLanguage(): Language {
  return localStorage.getItem(storageKey) === "fr" ? "fr" : "en";
}

export function useDesignLanguage() {
  const [language, updateLanguage] = useState(readLanguage);
  useEffect(() => {
    const update = () => updateLanguage(readLanguage());
    window.addEventListener(changeEvent, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(changeEvent, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const setLanguage = (value: Language) => {
    localStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event(changeEvent));
  };
  return { language, setLanguage, local: (en: string, fr: string) => language === "fr" ? fr : en };
}
