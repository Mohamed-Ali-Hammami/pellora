'use client';

/**
 * Liste des langues du pied de page.
 *
 * Îlot client pour la même raison que le sélecteur de l'en-tête : les liens
 * doivent viser la page équivalente, ce qui demande de connaître l'URL
 * courante — information qu'une mise en page racine n'a pas.
 */

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { localeNames, locales, type Locale } from '@/lib/i18n/config';
import { allEquivalents } from '@/lib/i18n/equivalent';

export function FooterLanguages({ current, title }: { current: Locale; title: string }) {
  const pathname = usePathname();
  const alternates = useMemo(() => allEquivalents(pathname ?? `/${current}`), [pathname, current]);

  return (
    <nav aria-label={title}>
      <p className="eyebrow mb-3">{title}</p>
      <ul className="space-y-2">
        {locales.map((locale) => (
          <li key={locale}>
            <a
              href={alternates[locale]}
              hrefLang={locale}
              aria-current={locale === current ? 'true' : undefined}
              className={`text-sm transition-colors hover:text-ember ${
                locale === current ? 'font-semibold text-ink' : 'text-ink-soft'
              }`}
            >
              {localeNames[locale]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
