import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";

import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }, { locale: "fr" }, { locale: "ka" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale matching
  if (!["en", "es", "fr", "ka"].includes(locale)) {
    notFound();
  }

  // Load message catalogue
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
    >
      <div className="flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
