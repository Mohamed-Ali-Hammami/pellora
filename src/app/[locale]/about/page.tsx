import type { Metadata } from 'next';
import { PageHeader } from '@/components/section';
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
    title: dict.about.title,
    description: dict.about.lead,
    alternates: routeAlternates('about'),
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.about.title} lead={dict.about.lead} />

      <div className="container-page py-12">
        <div className="prose-page">
          {dict.about.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <h2 className="mt-14 text-2xl">{dict.about.valuesTitle}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {dict.about.values.map((value) => (
            <article key={value.title} className="card p-6">
              <h3 className="text-lg">{value.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{value.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <a href={href('shop', locale)} className="btn-primary">{dict.shop.title}</a>
          <a href={href('contact', locale)} className="btn-secondary">{dict.contact.title}</a>
        </div>
      </div>
    </>
  );
}
