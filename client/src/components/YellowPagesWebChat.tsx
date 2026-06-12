import { createElement, useEffect } from "react";
import { useLocation } from "wouter";

const YELLOWPAGES_WEBCHAT_KEY = "1908829c-42a8-4556-a5f3-dff6981b019d";
const YELLOWPAGES_WEBCHAT_SCRIPT_SRC = "https://s3.eu-central-1.amazonaws.com/prod.website-widgets/webchat.bundle.js";
const YELLOWPAGES_WEBCHAT_SCRIPT_ID = "fixmydoor-yellowpages-webchat";

export default function YellowPagesWebChat() {
  const [location] = useLocation();
  const isAdminArea = location.startsWith("/admin");

  useEffect(() => {
    if (isAdminArea) {
      return;
    }

    const loadScript = () => {
      if (document.getElementById(YELLOWPAGES_WEBCHAT_SCRIPT_ID)) {
        return;
      }

      const script = document.createElement("script");
      script.id = YELLOWPAGES_WEBCHAT_SCRIPT_ID;
      script.src = YELLOWPAGES_WEBCHAT_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.type = "text/javascript";
      document.body.appendChild(script);
    };

    const timer = window.setTimeout(loadScript, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isAdminArea]);

  if (isAdminArea) {
    return null;
  }

  return createElement("webchat-widget", {
    "data-key": YELLOWPAGES_WEBCHAT_KEY,
  } as Record<string, string>);
}
