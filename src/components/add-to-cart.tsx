'use client';

/**
 * Choix de la finition, de la quantité, et ajout au panier.
 *
 * Les textes arrivent en propriétés : ce composant est client, il ne doit pas
 * importer le dictionnaire, sinon les quatre langues partiraient dans le
 * bundle du navigateur.
 */

import { useState } from 'react';
import { useCart, type AddOutcome } from './cart-provider';
import { interpolate } from '@/lib/format';
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
    /** « {count} dans votre panier » — confirme la quantité RÉELLE. */
    added: string;
    /** « Seulement {added} ajouté(s) : {max} au maximum par article. » */
    capped: string;
    /** « Maximum atteint : {max} par article. » */
    atMax: string;
    viewCart: string;
    increase: string;
    decrease: string;
  };
  /** Prix unitaires déjà formatés par le serveur, indexés par id de variante. */
  variantPrices: Record<string, string>;
}

export function AddToCart({ product, locale, cartHref, labels, variantPrices }: Props) {
  const { add, quantityOf, maxPerLine } = useCart();
  const [variantId, setVariantId] = useState<string | null>(product.variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [outcome, setOutcome] = useState<AddOutcome | null>(null);

  const déjà = quantityOf(product.id, variantId);
  const reste = Math.max(0, maxPerLine - déjà);
  const plein = reste === 0;

  function onAdd() {
    /*
     * On affiche ce que l'ajout a RÉELLEMENT produit, pas ce qui a été
     * demandé. Demander trois exemplaires quand il n'en reste que deux en
     * ajoutait deux, et le bouton répondait « Ajouté » : le client repartait
     * en croyant en avoir trois.
     */
    setOutcome(add(product.id, variantId, quantity));
    // Le retour s'efface de lui-même : un bouton qui reste figé sur sa
    // confirmation empêche de comprendre qu'on peut ajouter à nouveau.
    window.setTimeout(() => setOutcome(null), 5000);
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
              aria-label={labels.decrease}
              className="px-3 py-2.5 text-lg leading-none text-ink-soft transition-colors hover:text-ink disabled:opacity-35"
            >
              −
            </button>
            <input
              id={`qty-${product.id}`}
              type="number"
              min={1}
              max={Math.max(1, reste)}
              value={quantity}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                setQuantity(
                  Number.isNaN(next) ? 1 : Math.min(Math.max(1, reste), Math.max(1, next)),
                );
              }}
              className="tabular w-12 border-x border-line py-2.5 text-center text-sm font-semibold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(Math.max(1, reste), value + 1))}
              disabled={quantity >= reste}
              aria-label={labels.increase}
              className="px-3 py-2.5 text-lg leading-none text-ink-soft transition-colors hover:text-ink disabled:opacity-35"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={plein}
          className="btn-ember flex-1 min-w-[12rem] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {labels.add}
        </button>
      </div>

      {/*
        Une seule zone de message, toujours au même endroit, annoncée aux
        lecteurs d'écran. Trois cas, par ordre de priorité : ce qui vient de se
        passer, puis l'impossibilité d'ajouter davantage.
      */}
      <div role="status" aria-live="polite" className="min-h-[2.75rem]">
        {outcome ? (
          <p className="rounded-lg border border-line bg-cream px-3 py-2 text-sm">
            <span className={outcome.capped ? 'font-semibold text-[#6b4205]' : 'font-semibold'}>
              {outcome.capped
                ? interpolate(labels.capped, { added: outcome.added, max: outcome.max })
                : interpolate(labels.added, { count: outcome.quantity })}
            </span>{' '}
            <a href={cartHref} className="text-ember underline underline-offset-4">
              {labels.viewCart}
            </a>
          </p>
        ) : plein ? (
          <p className="rounded-lg border border-line bg-cream px-3 py-2 text-sm text-ink-soft">
            {interpolate(labels.atMax, { max: maxPerLine })}{' '}
            <a href={cartHref} className="text-ember underline underline-offset-4">
              {labels.viewCart}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
