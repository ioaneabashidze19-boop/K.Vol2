import { createNavigation } from "next-intl/navigation";

import { locales } from "./config";

// Exports navigation helpers that automatically prefix active locales using next-intl v4 API
export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
});
