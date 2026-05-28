/**
 * i18n Configuration Configuration
 * Defines supported locales, default locale, and global formatting variables.
 */

// Supported locales list in the app
export const locales = ["en", "es", "fr", "ka"] as const;

// Typescript type representation of supported locales
export type Locale = (typeof locales)[number];

// Fallback locale if matching fails
export const defaultLocale: Locale = "en";

// Default system timezone for date formatting structures
export const timeZone = "UTC";
