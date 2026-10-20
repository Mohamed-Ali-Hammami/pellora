/** Pied de page. Composant serveur. */

import { brand } from '@/lib/brand';
import { href } from '@/lib/i18n/routes';
import { categoryLinks } from '@/lib/i18n/nav';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { FooterLanguages } from './footer-languages';

interface Props {
  locale: Locale;
  dict: Dictionary;
}

export function Footer({ locale, dict }: Props) {
  const year = new Date().getFullYear();

  const columns = [
    {
      title: dict.footer.shopTitle,
      links: [
        ...categoryLinks(locale, dict).map((s) => ({ href: s.href, label: s.label })),
        { href: href('shop', locale), label: dict.shop.title },
        { href: href('sizing', locale), label: dict.sizing.title },
      ],
    },
    {
      title: dict.footer.helpTitle,
      links: [
        { href: href('faq', locale), label: dict.faq.title },
        { href: href('shipping', locale), label: dict.shippingPage.title },
        { href: href('returns', locale), label: dict.returns.title },
        { href: href('tracking', locale), label: dict.tracking.title },
        { href: href('contact', locale), label: dict.contact.title },
      ],
    },
    {
      title: dict.footer.legalTitle,
      links: [
        { href: href('terms', locale), label: dict.terms.title },
        { href: href('privacy', locale), label: dict.privacy.title },
        { href: href('legal', locale), label: dict.legalPage.title },
        { href: href('about', locale), label: dict.about.title },
        { href: href('guides', locale), label: dict.guides.title },
      ],
    },
  ];

  return (
    <footer className="mt-20 border-t border-line bg-cream">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)_auto]">
          <div>
            <p className="font-display text-xl font-semibold text-ink">Pellora</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{dict.footer.tagline}</p>
            <p className="mt-4 text-sm text-ink-soft">
              <a href={`mailto:${brand.email.support}`} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                {brand.email.support}
              </a>
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="eyebrow mb-3">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-sm text-ink-soft transition-colors hover:text-ember">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <FooterLanguages current={locale} title={dict.footer.languageTitle} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Pellora. {dict.footer.rights}
          </p>
          <p>{dict.footer.vatNote}</p>
          <p className="flex items-center gap-1.5">
            <LockIcon />
            {dict.footer.paymentNote}
          </p>
        </div>
      </div>
    </footer>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.6" y="6.2" width="8.8" height="6.2" rx="1.2" />
      <path d="M4.6 6.2V4.4a2.4 2.4 0 014.8 0v1.8" />
    </svg>
  );
}
