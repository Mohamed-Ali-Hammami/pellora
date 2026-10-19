import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/add-to-cart';
import { ProductCard } from '@/components/product-card';
import { ProductGallery } from '@/components/product-gallery';
import { Notice } from '@/components/section';
import { brand } from '@/lib/brand';
import { getCrossSell, getProductBySlug, products, unitPrice } from '@/lib/catalog';
import { decimal, integer, priceShort } from '@/lib/format';
import { savingsPercent } from '@/lib/money';
import { absoluteImageUrl, hasOnlyPlaceholders, primaryImage, resolveImages } from '@/lib/product-media';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { locales, type Locale } from '@/lib/i18n/config';
import { assertLocale, pageMetadata, productAlternates } from '@/lib/i18n/page';
import { href, productHref } from '@/lib/i18n/routes';

/**
 * Fiche produit.
 *
 * Toutes les fiches sont pré-générées : douze produits × quatre langues font
 * quarante-huit pages statiques, servies sans calcul et donc indexables sans
 * budget de crawl gaspillé.
 */
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    products.map((product) => ({ locale, slug: product.slug[locale] })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const locale = assertLocale(resolved.locale);
  const product = getProductBySlug(resolved.slug, locale);
  if (!product) return { title: getDictionary(locale).notFound.title };

  const bullets = product.bullets[locale];

  return pageMetadata({
    locale,
    title: product.name,
    description: `${product.tagline[locale]} ${bullets[0] ?? ''}`.trim(),
    alternates: productAlternates(product.slug),
    image: primaryImage(product).src,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const resolved = await params;
  const locale = assertLocale(resolved.locale);
  const dict = getDictionary(locale);
  const product = getProductBySlug(resolved.slug, locale);
  if (!product) notFound();

  const images = resolveImages(product);
  const bullets = product.bullets[locale];
  const crossSell = getCrossSell(product);
  const discount = product.compareAtPrice ? savingsPercent(product.compareAtPrice, product.price) : 0;
  const tech = product.tech;

  const variantPrices = Object.fromEntries(
    product.variants.map((variant) => [
      variant.id,
      priceShort(unitPrice(product, variant.id), locale),
    ]),
  );

  const categoryRoute = product.category === 'air' ? 'air' : product.category === 'hydro' ? 'hydro' : 'accessories';

  /**
   * Données structurées Schema.org.
   *
   * `price` et `availability` doivent refléter la réalité : une donnée
   * structurée fausse expose à une pénalité de référencement, et c'est aussi
   * une pratique commerciale trompeuse. `priceValidUntil` est volontairement
   * absent plutôt qu'inventé.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline[locale],
    image: images.map((image) => absoluteImageUrl(image.src, brand.url)),
    category: dict.categories[product.category],
    ...(tech
      ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: dict.product.powerRange, value: `${tech.powerMinKw}-${tech.powerMaxKw} kW` },
            { '@type': 'PropertyValue', name: dict.product.efficiency, value: `${tech.efficiencyPercent} %` },
            { '@type': 'PropertyValue', name: dict.product.energyClass, value: tech.energyClass },
          ],
        }
      : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: (product.price / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${brand.url}${productHref(product.slug[locale], locale)}`,
      seller: { '@type': 'Organization', name: brand.name },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="container-page pt-6">
        <nav aria-label={dict.nav.shop} className="text-sm text-muted">
          <a href={href('shop', locale)} className="hover:text-ink">
            {dict.shop.title}
          </a>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <a href={href(categoryRoute, locale)} className="hover:text-ink">
            {dict.categories[product.category]}
          </a>
        </nav>
      </div>

      <div className="container-page grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-14">
        <div className="lg:order-1">
          <ProductGallery
            images={images}
            locale={locale}
            placeholderNotice={dict.common.illustrationNotice}
          />
        </div>

        <div className="lg:order-2">
          <p className="eyebrow">{dict.categories[product.category]}</p>
          <h1 className="mt-2 text-3xl md:text-4xl">{product.name}</h1>
          <p className="mt-3 text-lg text-ink-soft">{product.tagline[locale]}</p>

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <p className="tabular text-3xl font-semibold text-ink">{priceShort(product.price, locale)}</p>
            {product.compareAtPrice ? (
              <>
                <p className="tabular text-lg text-muted line-through">
                  {priceShort(product.compareAtPrice, locale)}
                </p>
                <span className="chip-ember">
                  {dict.common.save} {discount} %
                </span>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{dict.common.vatIncludedLong}</p>

          {tech ? (
            <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-line bg-cream p-5 text-sm sm:grid-cols-3">
              {/* Les nombres passent par `Intl` : le français écrit « 2,1 kW »,
                  l'anglais « 2.1 kW ». Interpoler le nombre brut afficherait
                  le point décimal dans les quatre langues. */}
              <Fact
                label={dict.product.powerRange}
                value={`${decimal(tech.powerMinKw, locale)} – ${decimal(tech.powerMaxKw, locale)} kW`}
              />
              <Fact
                label={dict.product.heatedArea}
                value={`${integer(tech.heatedAreaMinM2, locale)} – ${integer(tech.heatedAreaMaxM2, locale)} m²`}
              />
              <Fact label={dict.product.efficiency} value={`${decimal(tech.efficiencyPercent, locale)} %`} />
              {tech.waterPowerKw !== null ? (
                <Fact
                  label={dict.product.waterPower}
                  value={`${decimal(tech.waterPowerKw, locale)} kW`}
                />
              ) : null}
              {tech.ductedOutlets ? (
                <Fact label={dict.product.ductedOutlets} value={integer(tech.ductedOutlets, locale)} />
              ) : null}
              <Fact label={dict.product.energyClass} value={tech.energyClass} />
            </dl>
          ) : null}

          <div className="mt-7">
            <AddToCart
              product={product}
              locale={locale}
              cartHref={href('cart', locale)}
              labels={{
                variant: dict.product.chooseVariant,
                quantity: dict.common.quantity,
                add: dict.common.addToCart,
                added: dict.common.added,
                viewCart: dict.common.viewCart,
              }}
              variantPrices={variantPrices}
            />
          </div>

          <ul className="mt-7 space-y-2.5 border-t border-line pt-6 text-sm text-ink-soft">
            <li className="flex gap-2.5">
              <Dot />
              {dict.common.dispatchedIn} {product.dispatchDaysMin}–{product.dispatchDaysMax}{' '}
              {dict.common.businessDays}
            </li>
            <li className="flex gap-2.5">
              <Dot />
              {product.freight ? dict.product.deliveryFreight : dict.product.deliveryParcel}
            </li>
            <li className="flex gap-2.5">
              <Dot />
              {dict.cart.securedBy}
            </li>
          </ul>

          {hasOnlyPlaceholders(product) ? (
            <p className="mt-5 text-xs leading-relaxed text-muted">{dict.common.illustrationNotice}</p>
          ) : null}
        </div>
      </div>

      {/* ───────────────────────────────── L'essentiel ───────────────────────────────── */}
      <section className="container-page py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-14">
          <div>
            <h2 className="text-2xl">{dict.product.keyPoints}</h2>
            <ul className="mt-5 space-y-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-ink-soft">
                  <CheckIcon />
                  {bullet}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-2xl">{dict.common.description}</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{product.description[locale]}</p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Notice title={dict.product.deliveryTitle}>
                {product.freight ? dict.product.deliveryFreight : dict.product.deliveryParcel}
              </Notice>
              <Notice title={dict.product.installTitle} tone="warn">
                {dict.product.installText}
              </Notice>
            </div>
          </div>

          <div>
            <h2 className="text-2xl">{dict.product.techSheet}</h2>
            <table className="mt-5 w-full text-sm">
              <tbody className="divide-y divide-line">
                {product.specs.map((spec) => (
                  <tr key={spec.label[locale]}>
                    <th scope="row" className="py-2.5 pr-4 text-left font-normal text-muted">
                      {spec.label[locale]}
                    </th>
                    <td className="tabular py-2.5 text-right font-medium text-ink">
                      {spec.value[locale]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {tech ? (
              <a href={href('sizing', locale)} className="btn-secondary mt-6 w-full">
                {dict.product.sizingHint}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {crossSell.length > 0 ? (
        <section className="border-t border-line bg-cream">
          <div className="container-page py-14">
            <h2 className="text-2xl">{dict.product.crossSellTitle}</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {crossSell.map((item) => (
                <ProductCard key={item.id} product={item} locale={locale} dict={dict} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Dot() {
  return <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ember" />;
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="mt-1.5 shrink-0 text-ember"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export type { Locale };
