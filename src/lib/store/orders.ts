/**
 * Cycle de vie des commandes : création, transitions, journal.
 *
 * Toutes les mutations passent par ces fonctions afin que `updatedAt` et le
 * journal d’événements restent systématiquement a jour — un journal partiel
 * ne sert a rien le jour où un client réclame.
 */

import { randomBytes } from 'node:crypto';
import type { Order, OrderLine, OrderStatus } from './types';
import type { PricedCart } from '../cart';
import type { ShippingAddress } from '../suppliers/types';
import { CURRENCY } from '../money';
import type { PublicOrder } from '../order-view';

/** Alphabet sans I, O, 0, 1 : une référence se lit au téléphone sans ambiguïté. */
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateOrderRef(prefix = 'VRS'): string {
  const bytes = randomBytes(6);
  let suffix = '';
  for (const byte of bytes) {
    suffix += REF_ALPHABET[byte % REF_ALPHABET.length];
  }
  return `${prefix}-${suffix}`;
}

export function cartToOrderLines(cart: PricedCart): OrderLine[] {
  return cart.lines.map((l) => ({
    productId: l.product.id,
    variantId: l.variant?.id ?? null,
    name: l.variant ? `${l.product.name} — ${l.variant.label}` : l.product.name,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
  }));
}

export function createOrder(params: {
  cart: PricedCart;
  email: string;
  stripeSessionId: string | null;
}): Order {
  const now = new Date().toISOString();
  return {
    ref: generateOrderRef(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    email: params.email,
    lines: cartToOrderLines(params.cart),
    subtotal: params.cart.subtotal,
    shippingPrice: params.cart.shipping.price,
    total: params.cart.total,
    vat: params.cart.vat,
    currency: CURRENCY,
    shippingLabel: params.cart.shipping.label,
    address: null,
    stripeSessionId: params.stripeSessionId,
    stripePaymentIntentId: null,
    supplierOrders: [],
    trackingNumber: null,
    carrier: null,
    events: [{ at: now, type: 'created' }],
    fulfillmentAttempts: 0,
  };
}

export function withEvent(order: Order, type: string, détail?: string): Order {
  const at = new Date().toISOString();
  return {
    ...order,
    updatedAt: at,
    events: [...order.events, détail === undefined ? { at, type } : { at, type, détail }],
  };
}

export function withStatus(order: Order, status: OrderStatus, détail?: string): Order {
  return { ...withEvent(order, `status:${status}`, détail), status };
}

export function withAddress(order: Order, address: ShippingAddress): Order {
  return { ...withEvent(order, 'address:set'), address };
}

export function withTracking(
  order: Order,
  trackingNumber: string | null,
  carrier: string | null,
): Order {
  const updated = withEvent(
    order,
    'tracking:set',
    trackingNumber ? `${carrier ?? 'transporteur'} ${trackingNumber}` : 'sans numéro',
  );
  return {
    ...updated,
    trackingNumber,
    carrier,
    status: trackingNumber ? 'shipped' : updated.status,
  };
}

/**
 * Vrai si CE fournisseur a déjà reçu la commande.
 * Garde-fou contre la double expédition, evalue fournisseur par fournisseur.
 */
export function isSupplierDone(order: Order, supplier: string): boolean {
  return order.supplierOrders.some((s) => s.supplier === supplier && s.status === 'ok');
}

/** Vrai si tous les fournisseurs sollicites ont confirme. */
export function isFullyForwarded(order: Order, suppliers: readonly string[]): boolean {
  return suppliers.length > 0 && suppliers.every((s) => isSupplierDone(order, s));
}

/** Vrai si un e-mail de ce type a déjà été envoyé (idempotence des notifications). */
export function hasSentEmail(order: Order, kind: 'confirmation' | 'shipping'): boolean {
  return order.events.some((e) => e.type === `email:${kind}_sent`);
}

export function recordSupplierResult(
  order: Order,
  record: import('./types').SupplierOrderRecord,
): Order {
  const others = order.supplierOrders.filter((s) => s.supplier !== record.supplier);
  const previous = order.supplierOrders.find((s) => s.supplier === record.supplier);
  return {
    ...order,
    supplierOrders: [
      ...others,
      { ...record, attempts: (previous?.attempts ?? 0) + 1 },
    ],
  };
}

/** Masque les données personnelles pour la page de suivi publique. */
export function toPublicOrder(order: Order): PublicOrder {
  return {
    ref: order.ref,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lines: order.lines.map((l) => ({ name: l.name, quantity: l.quantity })),
    total: order.total,
    currency: order.currency,
    shippingLabel: order.shippingLabel,
    trackingNumber: order.trackingNumber,
    carrier: order.carrier,
    city: order.address?.city ?? null,
    country: order.address?.country ?? null,
  };
}

