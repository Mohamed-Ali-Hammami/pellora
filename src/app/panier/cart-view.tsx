'use client';

/**
 * Page panier et départ vers le paiement.
 *
 * Le bouton de paiement n’envoie au serveur que des identifiants et des
 * quantités : c’est `/api/checkout` qui recalcule les prix. Les montants
 * affiches ici ne servent qu’a l’affichage.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useCart } from '@/components/cart-provider';
import { FreeShippingBar } from '@/components/free-shipping-bar';
import { formatPrice } from '@/lib/money';
import { defaultRate, zoneForCountry, SHIPPING_COUNTRIES } from '@/lib/shipping';

const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France', BE: 'Belgique', LU: 'Luxembourg', DE: 'Allemagne', NL: 'Pays-Bas',
  ES: 'Espagne', IT: 'Italie', PT: 'Portugal', AT: 'Autriche', IE: 'Irlande',
};

function CancelNotice() {
  const params = useSearchParams();
  if (params.get('annule') !== '1') return null;
  return (
    <div className="mb-6 rounded-card border border-line bg-cream p-4 text-sm">
      Paiement interrompu — votre panier est intact. Vous pouvez reprendre quand vous voulez.
    </div>
  );
}

export function CartView() {
  const { resolved, subtotal, itemCount, setQuantity, remove, loading } = useCart();
  const [country, setCountry] = useState('FR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shipping = defaultRate(subtotal, zoneForCountry(country));
  const total = subtotal + shipping.price;

  async function checkout() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Aucun prix transmis : le serveur les relit dans le catalogue.
          lines: resolved.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          shippingCountry: country,
          shippingRateId: shipping.id,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : 'Le paiement n’a pas pu s’ouvrir.';
        setError(message);
        return;
      }

      if (data && typeof data === 'object' && 'url' in data) {
        // Le panier n’est PAS vide ici : si le client abandonne sur la page
        // Stripe, il doit le retrouver intact au retour.
        window.location.href = String((data as { url: unknown }).url);
        return;
      }
      setError('Réponse inattendue du serveur.');
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-page py-16">
        <p className="text-muted">Chargement du panier…</p>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl">Votre panier est vide</h1>
        <p className="mt-3 text-ink-soft">Il n’y a rien de mieux à faire qu’aller voir le matériel.</p>
        <Link href="/produits" className="btn-primary mt-7">
          Voir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <Suspense fallback={null}>
        <CancelNotice />
      </Suspense>

      <h1 className="text-3xl">Panier</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <ul className="divide-y divide-line">
          {resolved.map((item) => (
            <li key={`${item.productId}-${item.variantId ?? ''}`} className="flex gap-4 py-5">
              {item.product.images[0] && (
                <Link href={`/produits/${item.product.slug}`} className="shrink-0">
                  <Image
                    src={item.product.images[0].src}
                    alt={item.product.images[0].alt}
                    width={110}
                    height={110}
                    className="size-24 rounded-lg border border-line bg-sand object-cover sm:size-28"
                  />
                </Link>
              )}

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/produits/${item.product.slug}`}
                      className="font-display text-base font-semibold hover:text-accent"
                    >
                      {item.product.name}
                    </Link>
                    {item.variant && (
                      <p className="text-sm text-muted">{item.variant.label}</p>
                    )}
                    <p className="mt-0.5 text-sm text-muted">
                      {formatPrice(item.unitPrice)} à l’unité
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatPrice(item.lineTotal)}</p>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center rounded-lg border border-line">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, item.variantId, item.quantity - 1)}
                      className="size-9 text-lg leading-none transition-colors hover:bg-cream"
                      aria-label={`Retirer un ${item.product.name}`}
                    >
                      &minus;
                    </button>
                    <span className="w-9 text-center text-sm font-semibold" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.productId, item.variantId, item.quantity + 1)}
                      className="size-9 text-lg leading-none transition-colors hover:bg-cream"
                      aria-label={`Ajouter un ${item.product.name}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(item.productId, item.variantId)}
                    className="text-sm text-muted underline transition-colors hover:text-accent"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4">
            <FreeShippingBar />

            <div className="card p-5">
              <label htmlFor="pays" className="block text-sm font-semibold">
                Pays de livraison
              </label>
              <select
                id="pays"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
              >
                {SHIPPING_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {COUNTRY_NAMES[code] ?? code}
                  </option>
                ))}
              </select>

              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Sous-total</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{shipping.label}</dt>
                  <dd>{shipping.price === 0 ? 'Offerte' : formatPrice(shipping.price)}</dd>
                </div>
                <div className="flex justify-between border-t-2 border-ink pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatPrice(total)}</dd>
                </div>
                <p className="text-xs text-muted">TVA incluse.</p>
              </dl>

              <button
                type="button"
                onClick={checkout}
                disabled={submitting}
                className="btn-primary mt-5 w-full"
              >
                {submitting ? 'Ouverture du paiement…' : 'Payer'}
              </button>

              {error && (
                <p role="alert" className="mt-3 text-sm font-medium text-accent">
                  {error}
                </p>
              )}

              <p className="mt-3 text-center text-xs text-muted">
                Paiement sécurisé par Stripe. Aucune donnée bancaire ne transite par ce site.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
