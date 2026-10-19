'use client';

/**
 * Menu de navigation mobile.
 *
 * Volontairement un panneau plein écran et non un tiroir latéral : sur une
 * boutique où chaque fiche produit est longue, un tiroir qui laisse la page
 * défiler derrière lui donne une impression de flottement.
 */

import { useEffect, useState } from 'react';

export interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: readonly NavLink[];
  secondary: readonly NavLink[];
  openLabel: string;
  closeLabel: string;
}

export function MobileNav({ links, secondary, openLabel, closeLabel }: Props) {
  const [open, setOpen] = useState(false);

  // Le défilement du corps est bloqué pendant l'ouverture, sinon le panneau
  // glisse avec la page sur iOS.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        className="rounded-lg border border-line p-2 text-ink transition-colors hover:border-ink md:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-paper md:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-lg font-semibold">Pellora</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="rounded-lg border border-line p-2 text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block rounded-lg px-2 py-3 font-display text-xl font-semibold text-ink transition-colors hover:bg-cream"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <ul className="mt-6 space-y-1 border-t border-line pt-6">
              {secondary.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block rounded-lg px-2 py-2 text-sm text-ink-soft transition-colors hover:bg-cream"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
