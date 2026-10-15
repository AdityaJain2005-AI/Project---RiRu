export const LOCALES = ["en", "hi", "ta"] as const;

export type Locale = (typeof LOCALES)[number];

export const DISCLAIMER_EN = "Informational only, not a medical diagnosis.";

const ENGLISH = {
  disclaimer: DISCLAIMER_EN,
  skipToContent: "Skip to content",
};

export type Copy = typeof ENGLISH;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Hindi and Tamil are reserved. Until translations exist, those locales return English and translated: false. */
export function messages(locale: string): { locale: Locale; translated: boolean; copy: Copy } {
  if (locale === "hi" || locale === "ta") {
    return { locale, translated: false, copy: ENGLISH };
  }
  return { locale: "en", translated: true, copy: ENGLISH };
}
