import { useLocale as useNextIntlLocale, useTranslations } from "next-intl";

import { usePathname as useLocalizedPathname, useRouter as useLocalizedRouter } from "./navigation";

/**
 * Custom translation hook returning a safe translate function.
 * Automatically handles missing keys with fallback resolution.
 * 
 * @param namespace Optional translation category/namespace (e.g. 'navigation', 'auth')
 * 
 * @example
 * const { t } = useTranslation('navigation');
 * return <button>{t('login', 'Sign In')}</button>;
 */
export function useTranslation(namespace?: string) {
  const t = useTranslations(namespace);

  const safeT = (key: string, defaultValue?: string): string => {
    try {
      // Resolve the message key from next-intl
      return t(key);
    } catch (err) {
      // Fallback to custom default value or key string if the message key doesn't exist
      return defaultValue || key;
    }
  };

  return { t: safeT };
}

/**
 * Custom hook to retrieve the current active locale.
 */
export function useLocale() {
  return useNextIntlLocale();
}

/**
 * Custom hook returning the localized router navigation object.
 */
export function useRouter() {
  return useLocalizedRouter();
}

/**
 * Custom hook returning the active localized pathname (without locale prefix).
 */
export function usePathname() {
  return useLocalizedPathname();
}
