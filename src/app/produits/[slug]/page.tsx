import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AddToCart } from '@/components/add-to-cart';
import { ProductCard } from '@/components/product-card';
import { getProductBySlug, getProductById, products } from '@/lib/catalog';
import { formatPrice, savingsPercent } from '@/lib/money';
import { brand } from '@/lib/brand';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

/** Toutes les fiches sont pre-generees : pages statiques, donc rapides et indexables. */
export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: 'Produit introuvable' };

  return {
    title: product.name,
    description: `${product.tagline} ${product.bullets[0] ?? ''}`.trim(),
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: {
      title: `${product.name} — ${brand.name}`,
      description: product.tagline,
      images: product.images[0] ? [{ url: product.images[0].src }] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const savings = product.compareAtPrice ? savingsPercent(product.compareAtPrice, product.price) : 0;
  const crossSell = product.crossSell
    .map((id) => getProductById(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const included = product.bundleOf
    .map((id) => getProductById(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  /**
   * Données structurées Schema.org.
   *
   * `availability` et `price` doivent refléter la réalité : une donnée
   * structurée fausse exposé à une pénalité de referencement, et c’est aussi
   * une pratique commerciale trompeuse.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((i) => `${brand.url}${i.src}`),
    brand: { '@type': 'Brand', name: brand.name },
    offers: {
      '@type': 'Offer',
      url: `${brand.url}/produits/${product.slug}`,
      priceCurrency: 'EUR',
      price: (product.price / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'FR' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          businessDays: { '@type': 'OpeningHoursSpecification' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY' },
        },
      },
    },
  };

  return (
    <div className="container-page py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Fil d’Ariane" className="text-sm text-muted">
        <Link href="/" className="hover:text-accent">
          Accueil
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/produits" className="hover:text-accent">
          Boutique
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink-soft">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="space-y-4">
          {product.images.map((image, index) => (
            <Image
              key={image.src}
              src={image.src}
              alt={image.alt}
              width={1000}
              height={1000}
              priority={index === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="w-full rounded-card border border-line bg-sand object-cover"
            />
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {product.badge && (
            <span className="inline-block rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
              {product.badge}
            </span>
          )}
          <h1 className="mt-3 text-3xl sm:text-4xl">{product.name}</h1>
          <p className="mt-2 text-lg text-ink-soft">{product.tagline}</p>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <>
                <span className="text-muted line-through">{formatPrice(product.compareAtPrice)}</span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">
                  -{savings} %
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            TVA incluse.{' '}
            {product.price >= FREE_SHIPPING_THRESHOLD
              ? 'Livraison offerte.'
              : `Livraison offerte dès ${formatPrice(FREE_SHIPPING_THRESHOLD)}.`}
          </p>

          <div className="mt-7">
            <AddToCart product={product} />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted">
            Expédié depuis les Pays-Bas en 2 a 4 jours ouvrés. Retour accepte sous 30 jours, au-delà
            des 14 jours légaux.
          </p>

          <div className="mt-8 border-t border-line pt-6">
            <p className="leading-relaxed text-ink-soft">{product.description}</p>

            <ul className="mt-5 space-y-2">
              {product.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2.5 text-sm text-ink-soft">
                  <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
                    &bull;
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {included.length > 0 && (
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="font-display text-lg">Ce que contient le lot</h2>
              <ul className="mt-3 divide-y divide-line-soft">
                {included.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                    <Link href={`/produits/${item.slug}`} className="hover:text-accent">
                      {item.name}
                    </Link>
                    <span className="shrink-0 text-muted">{formatPrice(item.price)} a l’unité</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="font-display text-lg">Caractéristiques</h2>
            <dl className="mt-3 divide-y divide-line-soft">
              {product.specs.map((spec) => (
                <div key={spec.label} className="flex justify-between gap-4 py-2 text-sm">
                  <dt className="text-muted">{spec.label}</dt>
                  <dd className="text-right font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {crossSell.length > 0 && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-2xl">A compléter avec</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {crossSell.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
