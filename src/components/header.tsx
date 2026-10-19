/**
 * En-tête du site. Composant serveur : seuls le compteur de panier, le menu
 * mobile et le sélecteur de langue sont des îlots client.
 */

import { CartBadge, CartCountLabel } from './cart-badge';
import { MobileNav, type NavLink } from './mobile-nav';
import { LocaleSwitcher } from './locale-switcher';
import { href, type RouteName } from '@/lib/i18n/routes';
import { locales, type Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries';

interface Props {
  locale: Locale;
  dict: Dictionary;
}

export function Header({ locale, dict }: Props) {
  const primary: readonly NavLink[] = [
    { href: href('air', locale), label: dict.nav.air },
    { href: href('hydro', locale), label: dict.nav.hydro },
    { href: href('accessories', locale), label: dict.nav.accessories },
    { href: href('sizing', locale), label: dict.nav.sizing },
    { href: href('guides', locale), label: dict.nav.guides },
  ];

  const secondary: readonly NavLink[] = (
    [
      ['about', dict.nav.about],
      ['faq', dict.nav.faq],
      ['shipping', dict.shippingPage.title],
      ['contact', dict.nav.contact],
    ] as const satisfies readonly (readonly [RouteName, string])[]
  ).map(([route, label]) => ({ href: href(route, locale), label }));

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="container-page flex h-16 items-center gap-4">
        <a href={href('home', locale)} className="flex items-center gap-2 shrink-0">
          <FlameMark />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">Pellora</span>
        </a>

        <nav aria-label={dict.nav.shop} className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {primary.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher current={locale} label={dict.nav.changeLanguage} />

          <a
            href={href('cart', locale)}
            className="relative flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
          >
            <CartIcon />
            <span className="hidden sm:inline">{dict.nav.cart}</span>
            <CartBadge />
            <CartCountLabel singular={dict.common.product} plural={dict.common.products} />
          </a>

          <MobileNav
            links={primary}
            secondary={secondary}
            openLabel={dict.nav.openMenu}
            closeLabel={dict.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}

/** Marque : une flamme stylisée, dessinée en SVG pour rester nette à toute taille. */
function FlameMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5c2.9 3.1 4.6 5.6 4.6 8.4 0 1.5-.5 2.7-1.4 3.6.2-1.6-.4-3-1.8-4.3.2 2.5-.7 4.1-2.3 5.3-1.1.8-1.7 1.6-1.7 2.6 0 .6.2 1.1.6 1.6-2.3-.8-3.8-2.9-3.8-5.6 0-3.9 2.6-7.1 5.8-11.6z"
        fill="var(--color-ember)"
      />
      <path
        d="M12 21.5c-1.4 0-2.4-.9-2.4-2.1 0-1 .6-1.6 1.4-2.3 1.1-.9 1.7-1.9 1.7-3.2 1.3 1.1 2.1 2.6 2.1 4.1 0 2-1.2 3.5-2.8 3.5z"
        fill="var(--color-flame)"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 2h2l1.6 8.4a1.4 1.4 0 001.4 1.1h6.8a1.4 1.4 0 001.4-1.1L16 5H4.3" />
      <circle cx="7" cy="15.2" r="1.1" />
      <circle cx="13.2" cy="15.2" r="1.1" />
    </svg>
  );
}

/** Toutes les langues disponibles — réexporté pour les pages qui bâtissent `alternates`. */
export { locales };
