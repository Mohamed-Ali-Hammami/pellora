import type { Metadata } from 'next';
import { ProductCard } from '@/components/product-card';
import { products, categoryLabels } from '@/lib/catalog';
import type { ProductCategory } from '@/lib/catalog.types';

export const metadata: Metadata = {
  title: 'Boutique',
  description:
    'Drippers, verseuses, moulins manuels, balances de précision et accessoires d’infusion, expédiés depuis l’Union européenne.',
  alternates: { canonical: '/produits' },
};

const ORDER: ProductCategory[] = ['kit', 'mouture', 'extraction', 'précision', 'accessoire'];

export default function ProductsPage() {
  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <p className="eyebrow">Boutique</p>
        <h1 className="mt-2 text-4xl">Tout le matériel</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          Onze références, pas trois cents. Chaque objet est ici parce qu’il change quelque chose
          dans la tasse — pas parce qu’il complète une gamme.
        </p>
      </header>

      {/* Ancres de catégorie : plus fiable qu’un filtre en JavaScript,
          et chaque section reste partageable par son lien. */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Catégories">
        {ORDER.filter((c) => products.some((p) => p.category === c)).map((category) => (
          <a
            key={category}
            href={`#${category}`}
            className="rounded-lg border border-line px-3.5 py-1.5 text-sm transition-colors hover:border-ink"
          >
            {categoryLabels[category]}
          </a>
        ))}
      </nav>

      {ORDER.map((category) => {
        const items = products.filter((p) => p.category === category);
        if (items.length === 0) return null;

        return (
          <section key={category} id={category} className="mt-14 scroll-mt-24">
            <h2 className="text-2xl">{categoryLabels[category]}</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={category === 'kit' && index === 0}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
