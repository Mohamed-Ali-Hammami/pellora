'use client';

/**
 * Bouton d’ajout au panier, avec choix de variante.
 *
 * Le retour visuel après clic est volontairement explicite : sans confirmation
 * immédiate, les visiteurs cliquent deux fois puis s’étonnent de la quantité.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './cart-provider';
import { formatPrice } from '@/lib/money';
import { unitPrice } from '@/lib/catalog';
import type { Product } from '@/lib/catalog.types';

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState<string | null>(
    product.variants.length > 0 ? product.variants[0]!.id : null,
  );
  const [added, setAdded] = useState(false);

  const price = unitPrice(product, variantId);

  function handleAdd() {
    add(product.id, variantId, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  }

  return (
    <div>
      {product.variants.length > 0 && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold">Finition</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const selected = variant.id === variantId;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setVariantId(variant.id)}
                  aria-pressed={selected}
                  className={`rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                    selected
                      ? 'border-ink bg-ink font-semibold text-white'
                      : 'border-line hover:border-ink'
                  }`}
                >
                  {variant.label}
                  {variant.priceDelta !== 0 && (
                    <span className={selected ? 'text-white/70' : 'text-muted'}>
                      {' '}
                      +{formatPrice(variant.priceDelta)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={handleAdd} className="btn-primary flex-1">
          Ajouter au panier — {formatPrice(price)}
        </button>
        <Link href="/panier" className="btn-secondary sm:w-auto">
          Voir le panier
        </Link>
      </div>

      {/* `aria-live` : la confirmation est annoncée aux lecteurs d’écran. */}
      <p aria-live="polite" className="mt-3 min-h-5 text-sm font-medium text-success">
        {added ? 'Ajoute au panier.' : ''}
      </p>
    </div>
  );
}
