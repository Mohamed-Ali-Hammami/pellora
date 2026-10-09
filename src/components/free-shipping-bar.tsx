'use client';

/**
 * Jauge de livraison offerte.
 *
 * C’est le levier le plus direct sur le panier moyen — et le panier moyen est,
 * d’après le modèle économique du projet, le paramètre qui décide de la
 * rentabilité. La barre n’apparaît que si le panier n’est pas vide, pour ne pas
 * annoncer un seuil avant tout achat.
 */

import { formatPrice } from '@/lib/money';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';
import { useCart } from './cart-provider';

export function FreeShippingBar() {
  const { subtotal, toFreeShipping, itemCount } = useCart();
  if (itemCount === 0) return null;

  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const reached = toFreeShipping === 0;

  return (
    <div className="rounded-card border border-line bg-cream p-4">
      <p className="text-sm">
        {reached ? (
          <span className="font-semibold text-success">Livraison offerte obtenue.</span>
        ) : (
          <>
            Encore <strong>{formatPrice(toFreeShipping)}</strong> pour la livraison offerte.
          </>
        )}
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progression vers la livraison offerte"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${reached ? 'bg-success' : 'bg-accent'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
