import type { Metadata } from 'next';
import { PageHeader } from '@/components/section';
import { guides } from '@/lib/guides';
import { date as formatDate } from '@/lib/format';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { guideHref } from '@/lib/i18n/routes';

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return pageMetadata({
    locale,
    title: dict.guides.title,
    description: dict.guides.lead,
    alternates: routeAlternates('guides'),
  });
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader eyebrow={dict.nav.guides} title={dict.guides.title} lead={dict.guides.lead} />

      <div className="container-page py-12">
        <ul className="grid gap-5 md:grid-cols-3">
          {guides.map((guide) => (
            <li key={guide.id}>
              <article className="card flex h-full flex-col p-6">
                <p className="eyebrow">
                  {guide.readingMinutes} {dict.guides.readingTime}
                </p>
                <h2 className="mt-2 text-xl leading-snug">
                  <a
                    href={guideHref(guide.slug[locale], locale)}
                    className="transition-colors hover:text-ember"
                  >
                    {guide.title[locale]}
                  </a>
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
                  {guide.description[locale]}
                </p>
                <p className="mt-5 text-xs text-muted">
                  {dict.guides.updated} {formatDate(guide.updated, locale)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
