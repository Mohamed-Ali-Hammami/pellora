import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/product-card';
import { getHeroProducts, getProductBySlug, products } from '@/lib/catalog';
import { formatPrice, savingsPercent } from '@/lib/money';
import { brand } from '@/lib/brand';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.pitch,
  alternates: { canonical: '/' },
};

/**
 * Page d’accueil.
 *
 * Choix de merchandising dicte par le modèle économique (cf. docs/ECONOMICS.md) :
 * le lot à 149 € est mis en avant AVANT le kit à 89 €. À coût d’acquisition
 * égal, c’est le panier moyen qui décide de la rentabilité — le produit
 * d’appel reste accessible, mais il n’est pas le chemin par défaut.
 */
export default function HomePage() {
  const flagship = getProductBySlug('kit-rituel-et-moulin');
  const entry = getProductBySlug('kit-rituel-complet');
  const heroes = getHeroProducts();
  const rest = products.filter((p) => !p.hero).slice(0, 4);

  return (
    <>
      {/* Bandeau de réassurance : les objections se lèvent avant le premier scroll. */}
      <div className="border-b border-line bg-cream">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-7 gap-y-1 py-2.5 text-center text-xs text-ink-soft">
          {brand.promises.map((promise) => (
            <span key={promise.title}>
              <strong className="font-semibold">{promise.title}</strong>
              <span className="text-muted"> — {promise.detail}</span>
            </span>
          ))}
        </div>
      </div>

      <section className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <div>
          <p className="eyebrow">Infusion manuelle</p>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-[3.4rem]">
            Le café filtre,
            <br />
            fait correctement.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
            Quatre objets suffisent à transformer une tasse : un cône qui garde la chaleur, une
            verseuse graduée, une balance au décigramme, un moulin à meules. Nous ne vendons que
            ceux-la — et nous expliquons comment les utiliser.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/produits" className="btn-primary">
              Découvrir la boutique
            </Link>
            <Link href="/guides/reussir-son-cafe-filtre" className="btn-secondary">
              Lire le guide d’infusion
            </Link>
          </div>

          <p className="mt-5 text-sm text-muted">
            Expédié depuis les Pays-Bas en 2 à 4 jours ouvrés. Livraison offerte dès{' '}
            {formatPrice(FREE_SHIPPING_THRESHOLD)}.
          </p>
        </div>

        {flagship && (
          <div className="relative">
            <Link
              href={`/produits/${flagship.slug}`}
              className="group block overflow-hidden rounded-card border border-line bg-sand"
            >
              {flagship.images[0] && (
                <Image
                  src={flagship.images[0].src}
                  alt={flagship.images[0].alt}
                  width={900}
                  height={900}
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
              )}
            </Link>
            <div className="card absolute bottom-4 left-4 right-4 p-4 shadow-sm sm:left-6 sm:right-auto sm:max-w-xs">
              <p className="eyebrow font-sans">Le choix de la rédaction</p>
              <h2 className="mt-1 font-display text-lg font-semibold">{flagship.name}</h2>
              <p className="mt-1 text-sm leading-snug text-muted">{flagship.tagline}</p>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-lg font-semibold">{formatPrice(flagship.price)}</span>
                {flagship.compareAtPrice && (
                  <>
                    <span className="text-sm text-muted line-through">
                      {formatPrice(flagship.compareAtPrice)}
                    </span>
                    <span className="text-sm font-semibold text-accent">
                      -{savingsPercent(flagship.compareAtPrice, flagship.price)} %
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="border-y border-line bg-cream py-14">
        <div className="container-page">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                title: 'Pèse, pas devine',
                body: 'Une cuillère à soupe de grains pèse entre 5 et 9 g selon la torréfaction. C’est assez pour rendre une recette irréproductible. Nos kits intègrent donc une balance au décigramme.',
              },
              {
                title: 'Moulu à la minute',
                body: 'Les arômes du café sont volatils : ils s’échappent dans les minutes qui suivent la mouture. Moudre juste avant l’infusion est le changement le plus audible sur une tasse.',
              },
              {
                title: 'Expédié d’Europe',
                body: 'Notre entrepôt est aux Pays-Bas, pas en Asie. Deux à quatre jours ouvrés, pas trois semaines — et un interlocuteur joignable en cas de problème.',
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Nos essentiels</p>
            <h2 className="mt-1.5 text-3xl">Par où commencer</h2>
          </div>
          <Link href="/produits" className="hidden shrink-0 text-sm font-semibold text-accent hover:underline sm:block">
            Tout voir
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {heroes.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index === 0} />
          ))}
        </div>
      </section>

      {entry && (
        <section className="border-y border-line bg-sand py-16">
          <div className="container-page grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            {entry.images[0] && (
              <Image
                src={entry.images[0].src}
                alt={entry.images[0].alt}
                width={800}
                height={800}
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="rounded-card border border-line bg-paper object-cover"
              />
            )}
            <div>
              <p className="eyebrow">Pour débuter</p>
              <h2 className="mt-1.5 text-3xl">{entry.name}</h2>
              <p className="mt-3 text-base leading-relaxed text-ink-soft">{entry.description}</p>
              <ul className="mt-5 space-y-2">
                {entry.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2.5 text-sm text-ink-soft">
                    <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
                      &bull;
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex items-center gap-4">
                <Link href={`/produits/${entry.slug}`} className="btn-primary">
                  Voir le kit — {formatPrice(entry.price)}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="container-page py-16">
        <p className="eyebrow">Compléter son matériel</p>
        <h2 className="mt-1.5 text-3xl">À l’unité</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
