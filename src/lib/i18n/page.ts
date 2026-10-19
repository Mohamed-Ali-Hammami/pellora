/**
 * Aides partagées par toutes les pages localisées.
 *
 * Mutualisées ici parce qu'une page qui oublie ses balises `hreflang` ou son
 * `canonical` crée du contenu dupliqué aux yeux des moteurs de recherche :
 * quatre URL servant le même texte, sans dire laquelle est la version
 * espagnole de laquelle.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { brand } from '../brand';
import { isLocale, locales, ogLocales, type Locale } from './config';
import { href, productHref, guideHref, type RouteName } from './routes';

/** `generateStaticParams` de toutes les pages sous `[locale]`. */
export function localeStaticParams(): { locale: Locale }[] {
  return locales.map((locale) => ({ locale }));
}

/** Valide le segment de langue d'une URL. Une langue inconnue est un 404. */
export function assertLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}

/** URL de la page courante dans les quatre langues — sélecteur de langue et `hreflang`. */
export function routeAlternates(route: RouteName): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, href(route, l)])) as Record<Locale, string>;
}

export function productAlternates(slugs: Record<Locale, string>): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, productHref(slugs[l], l)])) as Record<Locale, string>;
}

export function guideAlternates(slugs: Record<Locale, string>): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, guideHref(slugs[l], l)])) as Record<Locale, string>;
}

/**
 * Bloc `alternates` de `Metadata`.
 *
 * `x-default` pointe sur le français : c'est la langue du pays
 * d'établissement, donc celle à servir quand aucune des quatre ne correspond
 * à la préférence du visiteur.
 */
export function alternatesMetadata(
  locale: Locale,
  alternates: Record<Locale, string>,
): NonNullable<Metadata['alternates']> {
  return {
    canonical: alternates[locale],
    languages: {
      fr: alternates.fr,
      en: alternates.en,
      nl: alternates.nl,
      es: alternates.es,
      'x-default': alternates.fr,
    },
  };
}

/** Métadonnées complètes d'une page : titre, description, hreflang, Open Graph. */
export function pageMetadata({
  locale,
  title,
  description,
  alternates,
  image,
}: {
  locale: Locale;
  title: string;
  description: string;
  alternates: Record<Locale, string>;
  image?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: alternatesMetadata(locale, alternates),
    openGraph: {
      type: 'website',
      locale: ogLocales[locale],
      siteName: brand.name,
      title,
      description,
      url: `${brand.url}${alternates[locale]}`,
      ...(image ? { images: [{ url: image.startsWith('http') ? image : `${brand.url}${image}` }] } : {}),
    },
  };
}

/**
 * Noms de pays traduits, pour le sélecteur de livraison.
 * `Intl.DisplayNames` évite de maintenir à la main quatre listes de pays.
 */
export function countryNames(locale: Locale, codes: readonly string[]): Record<string, string> {
  const display = new Intl.DisplayNames([locale], { type: 'region' });
  return Object.fromEntries(codes.map((code) => [code, display.of(code) ?? code]));
}
