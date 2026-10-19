import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { CartProvider } from '@/components/cart-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { DemoBanner } from '@/components/demo-banner';
import { brand } from '@/lib/brand';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { htmlLangs, ogLocales } from '@/lib/i18n/config';
import { assertLocale, localeStaticParams } from '@/lib/i18n/page';

/**
 * Mise en page racine.
 *
 * Il n'y a volontairement pas de `src/app/layout.tsx` : le segment `[locale]`
 * est la racine, ce qui permet de poser `lang` sur `<html>` avec la vraie
 * langue de la page. Un `lang` faux dégrade la synthèse vocale, la coupure de
 * mots et la détection de langue des moteurs de recherche.
 */

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = assertLocale((await params).locale);

  return {
    metadataBase: new URL(brand.url),
    title: {
      default: `${brand.name} — ${brand.tagline[locale]}`,
      template: `%s — ${brand.name}`,
    },
    description: brand.pitch[locale],
    openGraph: {
      type: 'website',
      locale: ogLocales[locale],
      siteName: brand.name,
      title: `${brand.name} — ${brand.tagline[locale]}`,
      description: brand.pitch[locale],
    },
    twitter: { card: 'summary_large_image' },
    robots: {
      // Le site ne doit pas être indexé avant d'avoir ses vraies mentions
      // légales, ses vraies fiches techniques et ses vrais visuels : passez
      // NEXT_PUBLIC_ALLOW_INDEXING à « true » le jour du lancement.
      index: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
      follow: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
    },
    other: { 'format-detection': 'telephone=no' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#15110e',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <html lang={htmlLangs[locale]}>
      <body>
        <CartProvider>
          {/* Lien d'évitement : première chose atteinte au clavier. */}
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
          >
            {dict.nav.skipToContent}
          </a>

          <DemoBanner dict={dict} />
          <Header locale={locale} dict={dict} />

          <main id="contenu">{children}</main>

          <Footer locale={locale} dict={dict} />
        </CartProvider>
      </body>
    </html>
  );
}
