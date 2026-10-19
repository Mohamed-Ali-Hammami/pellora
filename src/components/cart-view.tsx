'use client';

/**
 * Page panier.
 *
 * Les montants affichés ici sont indicatifs : le serveur les recalcule
 * intégralement à l'ouverture du paiement (`/api/checkout`). Si les deux
 * divergent, c'est le serveur qui a raison — et c'est voulu, car seul lui
 * n'est pas modifiable depuis le navigateur.
 */

import { useMemo, useState } from 'react';
import { useCart } from './cart-provider';
import { ProductImage } from './product-image';
import { priceShort } from '@/lib/format';
import { interpolate } from '@/lib/format';
import { primaryImage } from '@/lib/product-media';
import { productHref } from '@/lib/i18n/routes';
import {
  SHIPPING_COUNTRIES,
  amountToFreeShipping,
  ratesFor,
  zoneForCountry,
} from '@/lib/shipping';
import { splitVatInclusive } from '@/lib/money';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  locale: Locale;
  shopHref: string;
  canceled: boolean;
  /** Noms de pays traduits, fournis par le serveur via `Intl.DisplayNames`. */
  countryNames: Record<string, string>;
  labels: {
    empty: string;
    emptyCta: string;
    quantity: string;
    remove: string;
    country: string;
    rate: string;
    subtotal: string;
    shipping: string;
    total: string;
    vatLine: string;
    checkout: string;
    checkoutPending: string;
    freeProgress: string;
    freeReached: string;
    canceled: string;
    error: string;
    secured: string;
    freightNotice: string;
    vatIncluded: string;
  };
}

export function CartView({ locale, shopHref, canceled, countryNames, labels }: Props) {
  const { resolved, subtotal, profile, setQuantity, remove, loading } = useCart();
  const [country, setCountry] = useState('FR');
  const [rateId, setRateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zone = zoneForCountry(country);
  const rates = useMemo(() => ratesFor(subtotal, zone, profile), [subtotal, zone, profile]);
  const rate = rates.find((r) => r.id === rateId) ?? rates[0];

  const total = subtotal + (rate?.price ?? 0);
  const vat = total > 0 ? splitVatInclusive(total).vat : 0;
  const missing = amountToFreeShipping(subtotal, zone, profile);

  async function checkout() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lines: resolved.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          shippingCountry: country,
          shippingRateId: rate?.id,
          locale,
        }),
      });

      const payload: unknown = await response.json();
      const url =
        typeof payload === 'object' && payload !== null && 'url' in payload
          ? (payload as { url?: unknown }).url
          : undefined;

      if (!response.ok || typeof url !== 'string') {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error?: unknown }).error)
            : labels.error;
        setError(message);
        setSubmitting(false);
        return;
      }

      // Redirection vers la page hébergée par Stripe : aucune donnée de carte
      // ne transite par ce site.
      window.location.assign(url);
    } catch {
      setError(labels.error);
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-cream" aria-hidden="true" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-cream p-10 text-center">
        <p className="text-ink-soft">{labels.empty}</p>
        <a href={shopHref} className="btn-primary mt-5">
          {labels.emptyCta}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <div>
        {canceled ? (
          <p role="status" className="mb-5 rounded-lg border border-warn/25 bg-[#fdf6e7] px-4 py-3 text-sm text-[#6b4205]">
            {labels.canceled}
          </p>
        ) : null}

        {profile.freight ? (
          <p className="mb-5 rounded-lg border border-line bg-cream px-4 py-3 text-sm text-ink-soft">
            {labels.freightNotice}
          </p>
        ) : null}

        <ul className="divide-y divide-line border-y border-line">
          {resolved.map((item) => {
            const image = primaryImage(item.product);
            return (
              <li key={`${item.productId}:${item.variantId ?? ''}`} className="flex gap-4 py-5">
                <a
                  href={productHref(item.product.slug[locale], locale)}
                  className="shrink-0 overflow-hidden rounded-lg border border-line bg-sand"
                >
                  <ProductImage
                    image={image}
                    locale={locale}
                    width={200}
                    height={200}
                    className="h-24 w-24 object-contain p-2"
                  />
                </a>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold leading-snug">
                    <a href={productHref(item.product.slug[locale], locale)} className="hover:text-ember">
                      {item.product.name}
                    </a>
                  </h2>
                  {item.variant ? (
                    <p className="text-sm text-muted">{item.variant.label[locale]}</p>
                  ) : null}
                  <p className="tabular mt-1 text-sm text-ink-soft">
                    {priceShort(item.unitPrice, locale)}
                  </p>

                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center rounded-lg border border-line">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.variantId, item.quantity - 1)}
                        aria-label="−"
                        className="px-2.5 py-1.5 text-ink-soft transition-colors hover:text-ink"
                      >
                        −
                      </button>
                      <span className="tabular w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.variantId, item.quantity + 1)}
                        disabled={item.quantity >= 5}
                        aria-label="+"
                        className="px-2.5 py-1.5 text-ink-soft transition-colors hover:text-ink disabled:opacity-35"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(item.productId, item.variantId)}
                      className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-danger"
                    >
                      {labels.remove}
                    </button>
                  </div>
                </div>

                <p className="tabular shrink-0 font-semibold">{priceShort(item.lineTotal, locale)}</p>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cart-country" className="mb-1.5 block text-sm font-semibold text-ink">
              {labels.country}
            </label>
            <select
              id="cart-country"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                // Le tarif précédent n'existe peut-être pas dans la nouvelle
                // zone : on repart sur le tarif par défaut.
                setRateId(null);
              }}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
            >
              {SHIPPING_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {countryNames[code] ?? code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cart-rate" className="mb-1.5 block text-sm font-semibold text-ink">
              {labels.rate}
            </label>
            <select
              id="cart-rate"
              value={rate?.id ?? ''}
              onChange={(event) => setRateId(event.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
            >
              {rates.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label[locale]} — {priceShort(option.price, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rate ? <p className="mt-2.5 text-xs leading-relaxed text-muted">{rate.note[locale]}</p> : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="card p-6">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">{labels.subtotal}</dt>
              <dd className="tabular font-semibold">{priceShort(subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{labels.shipping}</dt>
              <dd className="tabular font-semibold">{priceShort(rate?.price ?? 0, locale)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2.5 text-base">
              <dt className="font-semibold">{labels.total}</dt>
              <dd className="tabular text-lg font-semibold">{priceShort(total, locale)}</dd>
            </div>
            <div className="flex justify-between text-xs text-muted">
              <dt>{labels.vatLine}</dt>
              <dd className="tabular">{priceShort(vat, locale)}</dd>
            </div>
          </dl>

          <p className="mt-4 rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">
            {missing > 0
              ? interpolate(labels.freeProgress, { amount: priceShort(missing, locale) })
              : labels.freeReached}
          </p>

          <button type="button" onClick={checkout} disabled={submitting} className="btn-ember mt-5 w-full">
            {submitting ? labels.checkoutPending : labels.checkout}
          </button>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-relaxed text-muted">{labels.secured}</p>
        </div>
      </aside>
    </div>
  );
}
