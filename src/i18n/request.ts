import { getRequestConfig } from "next-intl/server";

import { defaultLocale, locales, timeZone } from "./config";
import type { Locale } from "./config";

export default getRequestConfig(async ({ locale }) => {
  // Locale validation, cast explicitly as Locale to satisfy typescript
  const activeLocale = (locales.includes(locale as any) ? locale : defaultLocale) as Locale;

  return {
    // next-intl v4 requires the locale parameter returned explicitly as a string
    locale: activeLocale as string,
    
    // Dynamic import of locale resources JSON catalogue
    messages: (await import(`../../messages/${activeLocale}.json`)).default,
    
    // Default time zone
    timeZone,

    // Custom global formatting rules for integers, floats, currencies, and dates
    formats: {
      dateTime: {
        short: {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
        long: {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
        },
      },
      number: {
        precise: {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
        currency: {
          style: "currency",
          currency: "USD",
          currencyDisplay: "symbol",
        },
        percent: {
          style: "percent",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        },
      },
    },
  };
});
