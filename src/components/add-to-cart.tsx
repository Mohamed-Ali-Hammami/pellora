'use client';

/**
 * Choix de la finition, de la quantité, et ajout au panier.
 *
 * Les textes arrivent en propriétés : ce composant est client, il ne doit pas
 * importer le dictionnaire, sinon les quatre langues partiraient dans le
 * bundle du navigateur.
 */

import { useState } from 'react';
import { useCart } from './cart-provider';
import type { Product } from '@/lib/catalog.types';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  product: Product;
  locale: Locale;
  cartHref: string;
  labels: {
    variant: string;
    quantity: string;
    add: string;
    added: string;
    viewCart: string;
  };
  /** Prix unitaires déjà formatés par le serveur, indexés par id de variante. */
  variantPrices: Record<string, string>;
}

export function AddToCart({ product, locale, cartHref, labels, variantPrices }: Props) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState<string | null>(product.variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  function onAdd() {
    add(product.id, variantId, quantity);
    setJustAdded(true);
    // Le retour visuel s'efface de lui-même : un bouton qui reste « Ajouté »
    // empêche de comprendre qu'on peut ajouter à nouveau.
    window.setTimeout(() => setJustAdded(false), 2600);
  }

  return (
    <div className="space-y-5">
      {product.variants.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{labels.variant}</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const selected = variant.id === variantId;
              return (
                <label
                  key={variant.id}
                  className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                    selected
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-paper text-ink-soft hover:border-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name={`variant-${product.id}`}
                    value={variant.id}
                    checked={selected}
                    onChange={() => setVariantId(variant.id)}
                    className="sr-only"
                  />
                  <span className="font-medium">{variant.label[locale]}</span>
                  {variant.priceDelta !== 0 ? (
                    <span className={`ml-1.5 tabular text-xs ${selected ? 'opacity-80' : 'text-muted'}`}>
                      +{(variant.priceDelta / 100).toLocaleString(locale)} €
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          {variantId && variantPrices[variantId] ? (
            <p className="mt-3 tabular text-2xl font-semibold text-ink">{variantPrices[variantId]}</p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`qty-${product.id}`} className="mb-2 block text-sm font-semibold text-ink">
            {labels.quantity}
          </label>
          <div className="flex items-center rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              aria-label="−"
              className="px-3 py-2.5 text-lg leading-none text-ink-soft transition-colors hover:text-ink disabled:opacity-35"
            >
              −
            </button>
            <input
              id={`qty-${product.id}`}
              type="number"
              min={1}
              max={5}
              value={quantity}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                setQuantity(Number.isNaN(next) ? 1 : Math.min(5, Math.max(1, next)));
              }}
              className="tabular w-12 border-x border-line py-2.5 text-center text-sm font-semibold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(5, value + 1))}
              disabled={quantity >= 5}
              aria-label="+"
              className="px-3 py-2.5 text-lg leading-none text-ink-soft transition-colors hover:text-ink disabled:opacity-35"
            >
              +
            </button>
          </div>
        </div>

        <button type="button" onClick={onAdd} className="btn-ember flex-1 min-w-[12rem]">
          {justAdded ? labels.added : labels.add}
        </button>
      </div>

      {justAdded ? (
        <p role="status" className="text-sm">
          <a href={cartHref} className="font-semibold text-ember underline underline-offset-4">
            {labels.viewCart}
          </a>
        </p>
      ) : null}
    </div>
  );
}
