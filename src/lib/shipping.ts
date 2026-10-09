/**
 * Règles de livraison.
 *
 * Volontairement simples et lisibles : les grilles de port compliquées font
 * abandonner le panier. Un seuil de gratuite, deux zones, un tarif au poids
 * au-dessous du seuil.
 */

import { euros, type Cents } from './money';

export type ShippingZone = 'FR' | 'EU';

export interface ShippingRate {
  id: string;
  label: string;
  /** Prix TTC. */
  price: Cents;
  minDays: number;
  maxDays: number;
}

/** Seuil de livraison offerte, TTC. Lève le panier moyen : à ajuster en même temps que le mix produits. */
export const FREE_SHIPPING_THRESHOLD = euros(60);

/** Pays desservis. Hors de cette liste, la commande est refusée avant paiement. */
export const SHIPPING_COUNTRIES = [
  'FR', 'BE', 'LU', 'DE', 'NL', 'ES', 'IT', 'PT', 'AT', 'IE',
] as const;

export type ShippingCountry = (typeof SHIPPING_COUNTRIES)[number];

export function isShippableCountry(code: string): code is ShippingCountry {
  return (SHIPPING_COUNTRIES as readonly string[]).includes(code);
}

export function zoneForCountry(code: string): ShippingZone {
  return code === 'FR' ? 'FR' : 'EU';
}

/**
 * Tarifs disponibles pour un sous-total et une zone.
 * Le sous-total est TTC, marchandise seule.
 */
export function ratesFor(subtotal: Cents, zone: ShippingZone): ShippingRate[] {
  const free = subtotal >= FREE_SHIPPING_THRESHOLD;

  if (zone === 'FR') {
    return [
      {
        id: 'fr-standard',
        label: free ? 'Livraison offerte (Colissimo)' : 'Colissimo suivi',
        price: free ? 0 : euros(4.9),
        minDays: 2,
        maxDays: 4,
      },
      { id: 'fr-express', label: 'Chronopost express', price: euros(9.9), minDays: 1, maxDays: 2 },
    ];
  }

  return [
    {
      id: 'eu-standard',
      label: free ? 'Livraison offerte (UE)' : 'Standard UE suivi',
      price: free ? 0 : euros(7.9),
      minDays: 3,
      maxDays: 6,
    },
  ];
}

export function findRate(subtotal: Cents, zone: ShippingZone, rateId: string): ShippingRate | undefined {
  return ratesFor(subtotal, zone).find((r) => r.id === rateId);
}

/** Tarif par défaut : le moins cher de la zone. */
export function defaultRate(subtotal: Cents, zone: ShippingZone): ShippingRate {
  const rates = ratesFor(subtotal, zone);
  const cheapest = rates.reduce((best, r) => (r.price < best.price ? r : best), rates[0]!);
  return cheapest;
}

/** Reste à ajouter pour déclencher la livraison offerte. 0 si déjà atteint. */
export function amountToFreeShipping(subtotal: Cents): Cents {
  return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
}
