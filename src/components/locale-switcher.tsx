'use client';

/**
 * Sélecteur de langue.
 *
 * Point important : le sélecteur emmène le visiteur sur la page ÉQUIVALENTE
 * dans l'autre langue, pas sur l'accueil. Un visiteur qui lit une fiche
 * produit en français et passe en espagnol doit retrouver la même fiche —
 * sinon il repart.
 *
 * Les équivalences sont calculées depuis le chemin courant par
 * `equivalentPath`, fonction pure et testée : la mise en page racine, elle,
 * ne connaît pas la page affichée et ne pourrait donc pas les fournir.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { localeNames, localeShortNames, locales, type Locale } from '@/lib/i18n/config';
import { allEquivalents } from '@/lib/i18n/equivalent';

interface Props {
  current: Locale;
  label: string;
}

export function LocaleSwitcher({ current, label }: Props) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const alternates = useMemo(() => allEquivalents(pathname ?? `/${current}`), [pathname, current]);

  // Fermeture au clic extérieur et à la touche Échap : un menu qui ne se
  // ferme pas est perçu comme un bug d'affichage.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
      >
        <GlobeIcon />
        <span>{localeShortNames[current]}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="opacity-60">
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-lg"
        >
          {locales.map((locale) => (
            <li key={locale} role="none">
              <a
                role="menuitem"
                href={alternates[locale]}
                hrefLang={locale}
                aria-current={locale === current ? 'true' : undefined}
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-cream ${
                  locale === current ? 'font-semibold text-ink' : 'text-ink-soft'
                }`}
              >
                <span>{localeNames[locale]}</span>
                <span className="text-xs text-muted">{localeShortNames[locale]}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M1.7 8h12.6M8 1.7c1.7 1.8 2.6 4 2.6 6.3S9.7 12.5 8 14.3C6.3 12.5 5.4 10.3 5.4 8S6.3 3.5 8 1.7z" />
    </svg>
  );
}
