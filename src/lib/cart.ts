/**
 * Logique de panier — fonctions pures, sans dépendance au navigateur ni au
 * réseau, donc testables directement.
 *
 * RÈGLE DE SÉCURITÉ CENTRALE : un panier qui arrive du client ne contient que
 * des identifiants et des quantités. Les prix sont TOUJOURS relus dans le
 * catalogue côté serveur par `priceCart`. Sans cela, n'importe qui peut
 * modifier le prix dans la requête et payer un centime.
 */

import { z } from 'zod';
import { getProductById, unitPrice, getVariant } from './catalog';
import { multiply, splitVatInclusive, type Cents } from './money';
import {
  defaultRate,
  findRate,
  zoneForCountry,
  type ShippingProfile,
  type ShippingRate,
} from './shipping';
import { locales } from './i18n/config';
import type { Locale } from './i18n/config';
import type { Product, ProductVariant } from './catalog.types';

/** Quantité maximale par ligne — limite les tests de fraude à la carte. */
export const MAX_QUANTITY_PER_LINE = 5;
export const MAX_LINES = 20;

/** Ce que le client est autorisé à envoyer : des ids et des quantités, rien de plus. */
export const cartInputSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        variantId: z.string().min(1).max(64).nullable().default(null),
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
      }),
    )
    .min(1)
    .max(MAX_LINES),
  shippingCountry: z.string().length(2).toUpperCase().default('FR'),
  shippingRateId: z.string().min(1).max(64).optional(),
  /** Langue du parcours : détermine la langue de la page de paiement et des e-mails. */
  locale: z.enum(locales).default('fr'),
});

export type CartInput = z.infer<typeof cartInputSchema>;

export interface PricedLine {
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
  unitPrice: Cents;
  lineTotal: Cents;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: Cents;
  shipping: ShippingRate;
  total: Cents;
  vat: Cents;
  netTotal: Cents;
  profile: ShippingProfile;
  itemCount: number;
  locale: Locale;
  /** Délai d'expédition le plus long du panier : c'est lui qui s'applique. */
  dispatchDaysMin: number;
  dispatchDaysMax: number;
}

export class CartError extends Error {
  constructor(
    message: string,
    readonly code: 'UNKNOWN_PRODUCT' | 'UNKNOWN_VARIANT' | 'UNKNOWN_RATE' | 'EMPTY',
  ) {
    super(message);
    this.name = 'CartError';
  }
}

/** Contraintes de transport imposées par un ensemble de lignes. */
export function profileFor(
  lines: readonly { product: Product; quantity: number }[],
): ShippingProfile {
  return {
    freight: lines.some((l) => l.product.freight),
    weightGrams: lines.reduce((acc, l) => acc + l.product.weightGrams * l.quantity, 0),
  };
}

/**
 * Transforme un panier client en panier chiffré, en relisant chaque prix dans
 * le catalogue. C'est le seul endroit où un total est calculé.
 */
export function priceCart(input: CartInput): PricedCart {
  if (input.lines.length === 0) {
    throw new CartError('panier vide', 'EMPTY');
  }

  // Fusionne les lignes en doublon (même produit + même variante).
  const merged = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const line of input.lines) {
    const key = `${line.productId}::${line.variantId ?? ''}`;
    const existing = merged.get(key);
    const quantity = Math.min(MAX_QUANTITY_PER_LINE, (existing?.quantity ?? 0) + line.quantity);
    merged.set(key, { productId: line.productId, variantId: line.variantId, quantity });
  }

  const lines: PricedLine[] = [];
  for (const line of merged.values()) {
    const product = getProductById(line.productId);
    if (!product) {
      throw new CartError(`produit inconnu : ${line.productId}`, 'UNKNOWN_PRODUCT');
    }

    const variant = getVariant(product, line.variantId);
    if (line.variantId !== null && variant === null) {
      throw new CartError(
        `variante inconnue « ${line.variantId} » pour ${product.id}`,
        'UNKNOWN_VARIANT',
      );
    }
    // Un produit à variantes exige un choix explicite : sinon le prix affiché
    // et le prix facturé peuvent différer.
    if (product.variants.length > 0 && variant === null) {
      throw new CartError(`variante requise pour ${product.id}`, 'UNKNOWN_VARIANT');
    }

    const unit = unitPrice(product, variant?.id ?? null);
    lines.push({
      product,
      variant,
      quantity: line.quantity,
      unitPrice: unit,
      lineTotal: multiply(unit, line.quantity),
    });
  }

  const subtotal = lines.reduce<Cents>((acc, l) => acc + l.lineTotal, 0);
  const zone = zoneForCountry(input.shippingCountry);
  const profile = profileFor(lines);

  const shipping = input.shippingRateId
    ? findRate(subtotal, zone, profile, input.shippingRateId)
    : defaultRate(subtotal, zone, profile);
  if (!shipping) {
    throw new CartError(`mode de livraison inconnu : ${input.shippingRateId}`, 'UNKNOWN_RATE');
  }

  const total = subtotal + shipping.price;
  const { net, vat } = splitVatInclusive(total);

  return {
    lines,
    subtotal,
    shipping,
    total,
    vat,
    netTotal: net,
    profile,
    itemCount: lines.reduce((acc, l) => acc + l.quantity, 0),
    locale: input.locale,
    // Le panier part en une seule expédition : c'est donc la ligne la plus
    // lente qui fixe la date, pas la plus rapide.
    dispatchDaysMin: Math.max(...lines.map((l) => l.product.dispatchDaysMin)),
    dispatchDaysMax: Math.max(...lines.map((l) => l.product.dispatchDaysMax)),
  };
}

/** Fenêtre de livraison annoncée, expédition comprise. */
export function deliveryWindow(
  cart: Pick<PricedCart, 'shipping' | 'dispatchDaysMin' | 'dispatchDaysMax'>,
  from: Date = new Date(),
): { earliest: Date; latest: Date } {
  return {
    earliest: addBusinessDays(from, cart.dispatchDaysMin + cart.shipping.minDays),
    latest: addBusinessDays(from, cart.dispatchDaysMax + cart.shipping.maxDays),
  };
}

export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}
