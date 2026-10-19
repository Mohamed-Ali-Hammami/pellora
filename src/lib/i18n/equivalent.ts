/**
 * Correspondance d'une URL d'une langue vers une autre.
 *
 * Sert au sélecteur de langue : un visiteur qui lit la fiche du Idro 15 en
 * français et choisit l'espagnol doit arriver sur la même fiche en espagnol,
 * pas sur l'accueil. Un sélecteur qui renvoie à l'accueil fait perdre la page
 * en cours, et c'est un abandon.
 *
 * Fonction pure, sans dépendance au navigateur, donc testable — elle est le
 * point de rupture silencieux de tout le maillage multilingue.
 */

import { products } from '../catalog';
import { guides } from '../guides';
import { isLocale, locales, type Locale } from './config';
import {
  canonicalPaths,
  dynamicPrefixes,
  guideHref,
  href,
  localizedPaths,
  productHref,
  routeNames,
  type RouteName,
} from './routes';

/** Chemins publics (localisés) classés du plus long au plus court, par langue. */
const staticIndex: Record<Locale, { path: string; route: RouteName }[]> = Object.fromEntries(
  locales.map((locale) => [
    locale,
    routeNames
      .map((route) => ({ path: localizedPaths[route][locale], route }))
      .filter((entry) => entry.path.length > 0)
      .sort((a, b) => b.path.length - a.path.length),
  ]),
) as Record<Locale, { path: string; route: RouteName }[]>;

/** Index canonique : utile quand l'URL a déjà été réécrite par le proxy. */
const canonicalIndex = routeNames
  .map((route) => ({ path: canonicalPaths[route], route }))
  .filter((entry) => entry.path.length > 0)
  .sort((a, b) => b.path.length - a.path.length);

function stripSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

/** Découpe une URL en langue + reste, ou `null` si elle ne porte pas de langue connue. */
export function splitLocalePath(pathname: string): { locale: Locale; rest: string } | null {
  const segments = stripSlashes(pathname).split('/').filter(Boolean);
  const first = segments[0];
  if (!first || !isLocale(first)) return null;
  return { locale: first, rest: segments.slice(1).join('/') };
}

/**
 * URL équivalente de `pathname` dans `target`.
 * Repli sur l'accueil de la langue cible quand l'URL n'est pas reconnue : il
 * vaut mieux une page d'accueil qu'un 404 au changement de langue.
 */
export function equivalentPath(pathname: string, target: Locale): string {
  const split = splitLocalePath(pathname);
  if (!split) return href('home', target);

  const { locale: source, rest } = split;
  if (rest.length === 0) return href('home', target);

  for (const entry of staticIndex[source]) {
    if (rest === entry.path) return href(entry.route, target);
  }
  for (const entry of canonicalIndex) {
    if (rest === entry.path) return href(entry.route, target);
  }

  const productPrefixes = [
    dynamicPrefixes.product.localized[source],
    dynamicPrefixes.product.canonical,
  ];
  for (const prefix of productPrefixes) {
    if (rest.startsWith(`${prefix}/`)) {
      const slug = rest.slice(prefix.length + 1);
      const product = products.find((item) => item.slug[source] === slug);
      if (product) return productHref(product.slug[target], target);
    }
  }

  const guidePrefixes = [dynamicPrefixes.guide.localized[source], dynamicPrefixes.guide.canonical];
  for (const prefix of guidePrefixes) {
    if (rest.startsWith(`${prefix}/`)) {
      const slug = rest.slice(prefix.length + 1);
      const guide = guides.find((item) => item.slug[source] === slug);
      if (guide) return guideHref(guide.slug[target], target);
    }
  }

  return href('home', target);
}

/** Les quatre URL équivalentes d'une URL donnée. */
export function allEquivalents(pathname: string): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, equivalentPath(pathname, l)])) as Record<
    Locale,
    string
  >;
}
