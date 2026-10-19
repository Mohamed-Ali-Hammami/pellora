/**
 * Routage des langues.
 *
 * Trois responsabilités, dans cet ordre :
 *
 *  1. toute URL sans préfixe de langue est redirigée (308) vers la langue
 *     négociée — cookie de préférence d'abord, en-tête `Accept-Language`
 *     ensuite, français par défaut ;
 *  2. une URL localisée (« /es/estufas/hidro ») est RÉÉCRITE vers sa route
 *     canonique (« /es/shop/hydro ») : le visiteur et les moteurs voient
 *     l'URL espagnole, l'arborescence `src/app` ne porte qu'un dossier ;
 *  3. le choix de langue est mémorisé en cookie, pour que le visiteur de
 *     retour ne reparte pas en français.
 *
 * Réécriture et non redirection au point 2 : une redirection ferait apparaître
 * l'URL canonique anglaise dans la barre d'adresse, ce qui annulerait tout
 * l'intérêt des slugs localisés.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, locales, negotiateLocale, type Locale } from './lib/i18n/config';
import { toCanonicalPath } from './lib/i18n/routes';

/** Nom du cookie de préférence de langue. */
const LOCALE_COOKIE = 'pellora_locale';
/** Un an : la langue d'un visiteur ne change pas d'une semaine à l'autre. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function localeFromCookie(request: NextRequest): Locale | null {
  const value = request.cookies.get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : null;
}

export function middleware(request: NextRequest): NextResponse {
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

  // ── 2. URL localisée : réécriture vers la route canonique. ──
  const canonical = toCanonicalPath(locale, rest);
  const response = canonical
    ? NextResponse.rewrite(new URL(`${canonical}${search}`, request.url))
    : NextResponse.next();

  // ── 3. Mémorisation de la langue effectivement servie. ──
  if (localeFromCookie(request) !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { maxAge: COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
  }

  return response;
}

export const config = {
  /**
   * Tout sauf : les routes API, les fichiers internes de Next, et toute URL
   * portant une extension (visuels, sitemap, robots, favicon). Sans cette
   * exclusion, le middleware redirigerait `/img/...` vers `/fr/img/...` et
   * les visuels disparaîtraient.
   */
  matcher: ['/((?!api/|_next/|.*\\.).*)'],
};

export { LOCALE_COOKIE, locales, defaultLocale };
