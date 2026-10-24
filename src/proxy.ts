/**
 * Routage des langues (« proxy » de Next 16, ex-middleware).
 *
 * Trois responsabilités, dans cet ordre :
 *
 *  1. toute URL sans préfixe de langue est redirigée (308) vers la langue
 *     négociée — cookie de préférence d'abord, en-tête `Accept-Language`
 *     ensuite, français par défaut ;
 *  2. une URL canonique atteinte directement (« /fr/shop/hydro ») est
 *     REDIRIGÉE vers sa forme publique (« /fr/poeles/hydro ») : sans cela,
 *     deux URL serviraient la même page ;
 *  3. une URL localisée (« /es/estufas/hidro ») est RÉÉCRITE vers sa route
 *     canonique (« /es/shop/hydro ») : le visiteur et les moteurs voient
 *     l'URL espagnole, l'arborescence `src/app` ne porte qu'un dossier ;
 *  4. le choix de langue est mémorisé en cookie, pour que le visiteur de
 *     retour ne reparte pas en français.
 *
 * Réécriture et non redirection au point 2 : une redirection ferait apparaître
 * l'URL canonique anglaise dans la barre d'adresse, ce qui annulerait tout
 * l'intérêt des slugs localisés.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, locales, negotiateLocale, type Locale } from './lib/i18n/config';
import { toCanonicalPath, toLocalizedPath } from './lib/i18n/routes';

/** Nom du cookie de préférence de langue. */
const LOCALE_COOKIE = 'pellora_locale';
/** Un an : la langue d'un visiteur ne change pas d'une semaine à l'autre. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function localeFromCookie(request: NextRequest): Locale | null {
  const value = request.cookies.get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : null;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];

  // ── 1. Pas de préfixe de langue : on redirige vers la langue négociée. ──
  if (!first || !isLocale(first)) {
    const locale =
      localeFromCookie(request) ?? negotiateLocale(request.headers.get('accept-language'));
    const target = new URL(`/${locale}${pathname === '/' ? '' : pathname}${search}`, request.url);
    const response = NextResponse.redirect(target, 308);
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
    return response;
  }

  const locale: Locale = first;
  const rest = segments.slice(1).join('/');

  // ── 2. URL canonique atteinte directement : redirection vers la forme publique. ──
  const localized = toLocalizedPath(locale, rest);
  if (localized !== null) {
    return NextResponse.redirect(new URL(`${localized}${search}`, request.url), 308);
  }

  // ── 3. URL localisée : réécriture vers la route canonique. ──
  const canonical = toCanonicalPath(locale, rest);
  const response = canonical
    ? NextResponse.rewrite(new URL(`${canonical}${search}`, request.url))
    : NextResponse.next();

  // ── 4. Mémorisation de la langue effectivement servie. ──
  if (localeFromCookie(request) !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
  }

  return response;
}

export const config = {
  /**
   * Tout sauf : les routes API, les fichiers internes de Next, et toute URL
   * portant une extension (visuels, sitemap, robots, favicon). Sans cette
   * exclusion, `/img/...` serait redirigé vers `/fr/img/...` et les visuels
   * disparaîtraient.
   *
   * `admin` est exclu pour la même raison : le back-office vit hors du système
   * de langues, et une redirection vers `/fr/admin` ne mènerait nulle part.
   */
  matcher: ['/((?!api/|admin|_next/|.*\\.).*)'],
};

export { LOCALE_COOKIE, locales, defaultLocale };
