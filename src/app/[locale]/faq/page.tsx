import type { Metadata } from 'next';
import { PageHeader } from '@/components/section';
import { brand } from '@/lib/brand';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    title: dict.faq.title,
    description: dict.faq.lead,
    alternates: routeAlternates('faq'),
  });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  /** Données structurées FAQ : elles doivent reprendre À L'IDENTIQUE le texte affiché. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dict.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader title={dict.faq.title} lead={dict.faq.lead} />

      <div className="container-page py-12">
        {/* `<details>` plutôt qu'un accordéon en JavaScript : le contenu reste
            dans le document, donc indexable, et fonctionne sans script. */}
        <div className="max-w-3xl divide-y divide-line border-y border-line">
          {dict.faq.items.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-display text-lg font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="mt-1.5 shrink-0 text-muted transition-transform group-open:rotate-45"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M8 2.5v11M2.5 8h11" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-line bg-cream p-6">
          <h2 className="text-xl">{dict.home.supportTitle}</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">{dict.home.supportLead}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={href('contact', locale)} className="btn-primary">{dict.home.supportCta}</a>
            <a href={`mailto:${brand.email.support}`} className="btn-secondary">{brand.email.support}</a>
          </div>
        </div>
      </div>
    </>
  );
}
