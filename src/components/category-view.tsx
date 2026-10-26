/**
 * Page d'une famille de produits, partagée par toutes les sections.
 *
 * Pourquoi une fabrique plutôt qu'un fichier par famille : le gabarit est identique à
 * la famille près. Le recopier huit fois garantirait qu'une correction sur
 * l'une oublie les sept autres.
 *
 * Les poêles à granulés sont présentés en deux groupes — air ventilé et
 * hydro — plutôt que derrière un filtre. Un filtre se règle par la chaîne de
 * requête, que l'export statique ne sait pas traiter ; surtout, le choix entre
 * les deux est le PREMIER que fait l'acheteur, et le lui montrer vaut mieux
 * que le lui faire chercher.
 */

import type { Metadata } from 'next';
import { ProductCard } from './product-card';
import { PageHeader } from './section';
import { getProductsByCategory } from '@/lib/catalog';
import { heatDistributions, type HeatDistribution, type ProductCategory } from '@/lib/catalog.types';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href, type RouteName } from '@/lib/i18n/routes';
import type { Locale } from '@/lib/i18n/config';
import type { Product } from '@/lib/catalog.types';

type Params = { params: Promise<{ locale: string }> };

export function categoryPage(category: ProductCategory, route: RouteName) {
  const name = category satisfies keyof Dictionary['categories'];
  const tagline = `${category}Tagline` as const;

  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const locale = assertLocale((await params).locale);
    const dict = getDictionary(locale);

    return pageMetadata({
      locale,
      title: dict.categories[name],
      description: dict.categories[tagline],
      alternates: routeAlternates(route),
    });
  }

  async function Page({ params }: Params) {
    const locale = assertLocale((await params).locale);
    const dict = getDictionary(locale);
    const items = getProductsByCategory(category);

    // Les deux modes ne sont séparés que s'ils coexistent réellement : une
    // section qui n'en contient qu'un n'a pas à s'encombrer d'un sous-titre.
    const groups = heatDistributions
      .map((mode) => [mode, items.filter((p) => p.distribution === mode)] as const)
      .filter(([, list]) => list.length > 0);
    const grouped = groups.length > 1;

    return (
      <>
        <PageHeader
          eyebrow={dict.nav.shop}
          title={dict.categories[name]}
          lead={dict.categories[tagline]}
        />

        <div className="container-page py-12">
          <p className="mb-8 text-sm text-muted">
            {items.length} {items.length === 1 ? dict.common.product : dict.common.products}
            {' · '}
            <a href={href('shop', locale)} className="underline underline-offset-4 hover:text-ink">
              {dict.shop.title}
            </a>
          </p>

          {items.length === 0 ? (
            <p className="rounded-xl border border-line bg-cream px-5 py-6 text-sm leading-relaxed text-ink-soft">
              {dict.common.sectionEmpty}
            </p>
          ) : grouped ? (
            <div className="space-y-14">
              {groups.map(([mode, list]) => (
                <section key={mode}>
                  <h2 className="text-2xl">{dict.distributions[mode]}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-ink-soft">
                    {dict.distributions[`${mode}Tagline` as const]}
                  </p>

                  {/* Le choix air / hydro est celui qui engage l'installation,
                      donc le plus coûteux à refaire. Les critères sont donnés
                      ici, où il se fait, et non dans un guide qu'il faut
                      penser à ouvrir. */}
                  <div className="mt-5 rounded-xl border border-line bg-cream px-5 py-4">
                    <p className="text-sm font-semibold text-ink">
                      {dict.distributions[`${mode}ChooseIf` as const]} :
                    </p>
                    <ul className="mt-2.5 space-y-1.5">
                      {dict.distributions[`${mode}Reasons` as const].map((reason) => (
                        <li key={reason} className="flex items-start gap-2.5 text-sm text-ink-soft">
                          <span
                            aria-hidden="true"
                            className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ember"
                          />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Grid items={list} locale={locale} dict={dict} />
                </section>
              ))}
            </div>
          ) : (
            <Grid items={items} locale={locale} dict={dict} />
          )}
        </div>
      </>
    );
  }

  return { generateStaticParams: localeStaticParams, generateMetadata, Page };
}

function Grid({
  items,
  locale,
  dict,
}: {
  items: readonly Product[];
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  );
}

export type { HeatDistribution };
