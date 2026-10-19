import type { Metadata } from 'next';
import { ProductCard } from '@/components/product-card';
import { PageHeader } from '@/components/section';
import { getProductsByCategory } from '@/lib/catalog';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

/** Page de famille : « hydro ». Entrée dédiée pour le référencement et le menu. */

const CATEGORY = 'hydro' as const;
const ROUTE = 'hydro' as const;

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
    title: dict.categories[CATEGORY],
    description: dict.categories[`${CATEGORY}Tagline`],
    alternates: routeAlternates(ROUTE),
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  const items = getProductsByCategory(CATEGORY);

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.shop}
        title={dict.categories[CATEGORY]}
        lead={dict.categories[`${CATEGORY}Tagline`]}
      />

      <div className="container-page py-12">
        <p className="mb-8 text-sm text-muted">
          {items.length} {items.length === 1 ? dict.common.product : dict.common.products}
          {' · '}
          <a href={href('shop', locale)} className="underline underline-offset-4 hover:text-ink">
            {dict.shop.title}
          </a>
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              dict={dict}
              priority={index < 4}
            />
          ))}
        </div>
      </div>
    </>
  );
}
