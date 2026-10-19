import type { Metadata } from 'next';
import { Notice, PageHeader } from '@/components/section';
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
    title: dict.returns.title,
    description: dict.returns.lead,
    alternates: routeAlternates('returns'),
  });
}

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.returns.title} lead={dict.returns.lead} />

      <div className="container-page py-12">
        <div className="prose-page">
          <h2>{dict.returns.rightTitle}</h2>
          <p>{dict.returns.rightText}</p>

          <h2>{dict.returns.conditionsTitle}</h2>
          <ul>
            {dict.returns.conditions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{dict.returns.warrantyTitle}</h2>
          <p>{dict.returns.warrantyText}</p>

          <h2>{dict.returns.exclusionsTitle}</h2>
          <ul>
            {dict.returns.exclusions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-10 max-w-2xl">
          <Notice title={dict.returns.damagedTitle} tone="warn">
            {dict.returns.damagedText}
          </Notice>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href={href('contact', locale)} className="btn-primary">{dict.contact.title}</a>
          <a href={href('terms', locale)} className="btn-secondary">{dict.terms.title}</a>
        </div>
      </div>
    </>
  );
}
