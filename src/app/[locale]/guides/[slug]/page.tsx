import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { PageHeader } from '@/components/section';
import { getGuideBySlug, guides } from '@/lib/guides';
import { getProductById } from '@/lib/catalog';
import { date as formatDate } from '@/lib/format';
import { brand } from '@/lib/brand';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { locales } from '@/lib/i18n/config';
import { assertLocale, guideAlternates, pageMetadata } from '@/lib/i18n/page';
import { guideHref, href } from '@/lib/i18n/routes';

export function generateStaticParams() {
  return locales.flatMap((locale) => guides.map((guide) => ({ locale, slug: guide.slug[locale] })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const locale = assertLocale(resolved.locale);
  const guide = getGuideBySlug(resolved.slug, locale);
  if (!guide) return { title: getDictionary(locale).notFound.title };

  return pageMetadata({
    locale,
    title: guide.title[locale],
    description: guide.description[locale],
    alternates: guideAlternates(guide.slug),
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const resolved = await params;
  const locale = assertLocale(resolved.locale);
  const dict = getDictionary(locale);
  const guide = getGuideBySlug(resolved.slug, locale);
  if (!guide) notFound();

  const related = guide.relatedProducts.flatMap((id) => {
    const product = getProductById(id);
    return product ? [product] : [];
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title[locale],
    description: guide.description[locale],
    dateModified: guide.updated,
    inLanguage: locale,
    author: { '@type': 'Organization', name: brand.name },
    publisher: { '@type': 'Organization', name: brand.name },
    mainEntityOfPage: `${brand.url}${guideHref(guide.slug[locale], locale)}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        eyebrow={`${guide.readingMinutes} ${dict.guides.readingTime} · ${dict.guides.updated} ${formatDate(guide.updated, locale)}`}
        title={guide.title[locale]}
        lead={guide.intro[locale]}
      />

      <article className="container-page py-12">
        <div className="prose-page">
          {guide.sections.map((section) => (
            <section key={section.heading[locale]}>
              <h2>{section.heading[locale]}</h2>
              {section.paragraphs[locale].map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.list ? (
                <ul>
                  {section.list[locale].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <p className="mt-10">
          <a href={href('guides', locale)} className="text-sm text-ember underline underline-offset-4">
            ← {dict.guides.backToGuides}
          </a>
        </p>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-line bg-cream">
          <div className="container-page py-14">
            <h2 className="text-2xl">{dict.guides.relatedProducts}</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} dict={dict} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
