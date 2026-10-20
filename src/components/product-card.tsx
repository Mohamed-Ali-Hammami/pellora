/** Carte produit des grilles. Composant serveur. */

import { priceShort, rangeOrMax } from '@/lib/format';
import { productHref } from '@/lib/i18n/routes';
import { primaryImage } from '@/lib/product-media';
import { savingsPercent } from '@/lib/money';
import { ProductImage } from './product-image';
import type { Product } from '@/lib/catalog.types';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries';

interface Props {
  product: Product;
  locale: Locale;
  dict: Dictionary;
  priority?: boolean;
}

export function ProductCard({ product, locale, dict, priority }: Props) {
  const image = primaryImage(product);
  const url = productHref(product.slug[locale], locale);
  const discount = product.compareAtPrice ? savingsPercent(product.compareAtPrice, product.price) : 0;

  return (
    <article className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-[0_8px_30px_-12px_rgb(23_18_15_/_0.18)]">
      <a href={url} className="relative block aspect-square overflow-hidden bg-sand" tabIndex={-1} aria-hidden="true">
        <ProductImage
          image={image}
          locale={locale}
          width={600}
          height={600}
          priority={priority}
          sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 90vw"
          className="h-full w-full object-contain p-6 transition-transform duration-300 group-hover:scale-[1.03]"
        />

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.badge ? <span className="chip-ember">{product.badge[locale]}</span> : null}
          {discount > 0 ? (
            <span className="chip bg-paper">
              −{discount} %
            </span>
          ) : null}
        </div>
      </a>

      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow">{dict.categories[`${product.category}Short`]}</p>

        <h3 className="mt-1.5 text-lg leading-snug">
          <a href={url} className="transition-colors hover:text-ember">
            {product.name}
          </a>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{product.tagline[locale]}</p>

        {product.tech ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-soft pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted">{dict.product.powerRange}</dt>
              <dd className="tabular font-semibold text-ink">
                {rangeOrMax(product.tech.powerMinKw, product.tech.powerMaxKw, 'kW', locale, dict.common.upTo)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{dict.product.heatedArea}</dt>
              <dd className="tabular font-semibold text-ink">
                {rangeOrMax(product.tech.heatedAreaMinM2, product.tech.heatedAreaMaxM2, 'm²', locale, dict.common.upTo, 0)}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="tabular text-xl font-semibold text-ink">{priceShort(product.price, locale)}</p>
            <p className="text-xs text-muted">
              {product.compareAtPrice ? (
                <span className="mr-1.5 line-through">{priceShort(product.compareAtPrice, locale)}</span>
              ) : null}
              {dict.common.vatIncluded}
            </p>
          </div>

          <a href={url} className="btn-secondary shrink-0 px-4 py-2 text-sm">
            {dict.common.viewProduct}
          </a>
        </div>
      </div>
    </article>
  );
}
