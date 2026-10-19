import type { Metadata } from 'next';
import { ProductCard } from '@/components/product-card';
import { ShopFilters } from '@/components/shop-filters';
import { PageHeader } from '@/components/section';
import { products } from '@/lib/catalog';
import { powerBands, type PowerBandId } from '@/lib/sizing';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';
import type { ProductCategory } from '@/lib/catalog.types';

/**
 * Boutique complète, avec filtres.
 *
 * Le filtrage est fait ici, côté serveur, à partir des paramètres d'URL :
 * chaque combinaison de filtres a donc sa propre adresse, partageable et
 * indexable, et la page fonctionne sans JavaScript.
 */

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
    title: dict.meta.shopTitle,
    description: dict.meta.shopDescription,
    alternates: routeAlternates('shop'),
  });
}

type SortId = 'power-asc' | 'power-desc' | 'price-asc' | 'price-desc';

const sortIds: readonly SortId[] = ['power-asc', 'power-desc', 'price-asc', 'price-desc'];

function isSortId(value: string): value is SortId {
  return (sortIds as readonly string[]).includes(value);
}

function isCategory(value: string): value is ProductCategory {
  return value === 'air' || value === 'hydro' || value === 'accessoire';
}

function isPowerBand(value: string): value is PowerBandId {
  return powerBands.some((band) => band.id === value);
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  const query = await searchParams;

  const read = (key: string): string => {
    const value = query[key];
    return typeof value === 'string' ? value : '';
  };

  const category = isCategory(read('category')) ? (read('category') as ProductCategory) : 'all';
  const power = isPowerBand(read('power')) ? (read('power') as PowerBandId) : 'all';
  const sort: SortId = isSortId(read('sort')) ? (read('sort') as SortId) : 'power-asc';

  let visible = products.slice();

  if (category !== 'all') {
    visible = visible.filter((product) => product.category === category);
  }

  if (power !== 'all') {
    const band = powerBands.find((item) => item.id === power);
    if (band) {
      // Un accessoire n'a pas de puissance : filtrer par kW l'exclut, ce qui
      // est le comportement attendu.
      visible = visible.filter(
        (product) =>
          product.tech !== null &&
          product.tech.powerMaxKw > band.minKw &&
          product.tech.powerMaxKw <= band.maxKw,
      );
    }
  }

  visible.sort((a, b) => {
    // Un accessoire n'a pas de puissance. Trier sur `?? 0` le placerait en
    // tête d'un tri croissant : la page « Tous les poêles » s'ouvrirait sur
    // un aspirateur à cendres. Les sans-puissance vont donc toujours à la
    // fin des tris par puissance, quel que soit le sens.
    if (sort === 'power-asc' || sort === 'power-desc') {
      if ((a.tech === null) !== (b.tech === null)) return a.tech === null ? 1 : -1;
      const delta = (a.tech?.powerMaxKw ?? 0) - (b.tech?.powerMaxKw ?? 0);
      return sort === 'power-asc' ? delta : -delta;
    }
    return sort === 'price-asc' ? a.price - b.price : b.price - a.price;
  });

  const powerLabels: Record<PowerBandId, string> = {
    upto8: `≤ 8 kW`,
    '8to12': `8 – 12 kW`,
    '12to18': `12 – 18 kW`,
    over18: `> 18 kW`,
  };

  return (
    <>
      <PageHeader eyebrow={dict.nav.shop} title={dict.shop.title} lead={dict.shop.lead} />

      <div className="container-page py-10">
        <ShopFilters
          basePath={href('shop', locale)}
          current={{ category, power, sort }}
          options={{
            category: [
              { value: 'all', label: dict.shop.filterAll },
              { value: 'air', label: dict.categories.airShort },
              { value: 'hydro', label: dict.categories.hydroShort },
              { value: 'accessoire', label: dict.categories.accessoireShort },
            ],
            power: [
              { value: 'all', label: dict.shop.anyPower },
              ...powerBands.map((band) => ({ value: band.id, label: powerLabels[band.id] })),
            ],
            sort: [
              { value: 'power-asc', label: dict.shop.sortPowerAsc },
              { value: 'power-desc', label: dict.shop.sortPowerDesc },
              { value: 'price-asc', label: dict.shop.sortPriceAsc },
              { value: 'price-desc', label: dict.shop.sortPriceDesc },
            ],
          }}
          labels={{
            category: dict.shop.filterCategory,
            power: dict.shop.filterPower,
            sort: dict.shop.sortBy,
            reset: dict.common.resetFilters,
            apply: dict.common.seeAll,
          }}
          resultCount={visible.length}
          resultLabel={dict.common.results}
        />

        {visible.length === 0 ? (
          <p className="mt-10 rounded-xl border border-line bg-cream p-8 text-center text-ink-soft">
            {dict.common.noResults}
          </p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                dict={dict}
                priority={index < 4}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
