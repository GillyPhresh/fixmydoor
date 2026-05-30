type CountryPhoneMeta = {
  label: string;
  dialCode: string;
  placeholder: string;
  patterns: RegExp[];
};

const COUNTRY_PHONE_META: CountryPhoneMeta[] = [
  { label: "Canada", dialCode: "1", placeholder: "+1 (438) 000-0000", patterns: [/canada/i, /\bca\b/i, /montreal|quebec|laval|longueuil|brossard/i] },
  { label: "United States", dialCode: "1", placeholder: "+1 (555) 000-0000", patterns: [/united states|usa|u\.s\.a\.|america/i] },
  { label: "Ghana", dialCode: "233", placeholder: "+233 24 000 0000", patterns: [/ghana/i] },
  { label: "Nigeria", dialCode: "234", placeholder: "+234 800 000 0000", patterns: [/nigeria/i] },
  { label: "United Kingdom", dialCode: "44", placeholder: "+44 20 0000 0000", patterns: [/united kingdom|uk|england|scotland|wales/i] },
  { label: "France", dialCode: "33", placeholder: "+33 6 00 00 00 00", patterns: [/france/i] },
  { label: "Germany", dialCode: "49", placeholder: "+49 151 00000000", patterns: [/germany/i] },
  { label: "India", dialCode: "91", placeholder: "+91 90000 00000", patterns: [/india/i] },
  { label: "United Arab Emirates", dialCode: "971", placeholder: "+971 50 000 0000", patterns: [/uae|dubai|united arab emirates/i] },
];

export function getPhoneCountryMeta(countryOrLocation?: string | null) {
  const value = (countryOrLocation || "").trim();
  return COUNTRY_PHONE_META.find((meta) => meta.patterns.some((pattern) => pattern.test(value))) || COUNTRY_PHONE_META[0];
}

export function getPhonePlaceholder(countryOrLocation?: string | null) {
  return getPhoneCountryMeta(countryOrLocation).placeholder;
}

export function normalizePhoneForMessaging(phone: string, countryOrLocation?: string | null) {
  const rawPhone = (phone || "").trim();
  const meta = getPhoneCountryMeta(countryOrLocation);

  if (!rawPhone) {
    return "";
  }

  if (rawPhone.startsWith("+")) {
    const digits = rawPhone.replace(/\D/g, "");
    return digits.length >= 8 ? `+${digits}` : "";
  }

  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("00") && digits.length > 10) {
    return `+${digits.slice(2)}`;
  }

  if (meta.dialCode === "1") {
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
  }

  if (digits.startsWith(meta.dialCode) && digits.length > meta.dialCode.length + 5) {
    return `+${digits}`;
  }

  const localDigits = meta.dialCode === "1" ? digits : digits.replace(/^0+/, "");
  return localDigits.length >= 6 ? `+${meta.dialCode}${localDigits}` : "";
}

export function formatPhoneForCountry(phone: string, countryOrLocation?: string | null) {
  const normalizedPhone = normalizePhoneForMessaging(phone, countryOrLocation);
  return normalizedPhone || phone;
}

export function getWhatsAppUrl(phone: string, countryOrLocation: string | null | undefined, message: string) {
  const normalizedPhone = normalizePhoneForMessaging(phone, countryOrLocation);
  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function getSmsUrl(phone: string, countryOrLocation: string | null | undefined, message: string) {
  const normalizedPhone = normalizePhoneForMessaging(phone, countryOrLocation);
  if (!normalizedPhone) {
    return "";
  }

  return `sms:${normalizedPhone}?&body=${encodeURIComponent(message)}`;
}
