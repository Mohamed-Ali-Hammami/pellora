/**
 * Client Stripe — SERVEUR UNIQUEMENT.
 *
 * On délègue à Stripe Checkout plutôt que de construire un formulaire de
 * paiement : la page est hébergée par Stripe, donc aucune donnée de carte ne
 * traverse ce code. Cela change la portée PCI-DSS (SAQ A au lieu de SAQ A-EP)
 * et évite d’avoir à gérer soi-même 3-D Secure, Apple Pay et Google Pay.
 */

import Stripe from 'stripe';
import { brand } from './brand';
import { CURRENCY } from './money';
import type { PricedCart } from './cart';
import { SHIPPING_COUNTRIES } from './shipping';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY absente — le paiement ne peut pas fonctionner. ' +
        'Copiez .env.example vers .env.local et renseignez vos clés Stripe.',
    );
  }
  // Pas de `apiVersion` force : le SDK utilise la version qu’il connaît, ce
  // qui évite un désaccord entre les types TypeScript et le serveur Stripe.
  client ??= new Stripe(key, { typescript: true });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Construit les lignes de la session de paiement.
 *
 * `tax_behavior: 'inclusive'` est déterminant : nos prix catalogue sont TTC
 * (obligation d’affichage au consommateur en France). Sans ce drapeau, Stripe
 * ajouterait la TVA par-dessus et le client paierait 20 % de trop.
 */
export function cartToLineItems(cart: PricedCart): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return cart.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: CURRENCY.toLowerCase(),
      unit_amount: line.unitPrice,
      tax_behavior: 'inclusive',
      product_data: {
        name: line.variant ? `${line.product.name} — ${line.variant.label}` : line.product.name,
        description: line.product.tagline,
        metadata: {
          product_id: line.product.id,
          variant_id: line.variant?.id ?? '',
        },
      },
    },
  }));
}

export function cartToShippingOptions(
  cart: PricedCart,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: cart.shipping.label,
        fixed_amount: { amount: cart.shipping.price, currency: CURRENCY.toLowerCase() },
        tax_behavior: 'inclusive',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: cart.shipping.minDays },
          maximum: { unit: 'business_day', value: cart.shipping.maxDays },
        },
      },
    },
  ];
}

export const allowedShippingCountries =
  SHIPPING_COUNTRIES as unknown as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

export function successUrl(): string {
  return `${brand.url}/commande/succes?session_id={CHECKOUT_SESSION_ID}`;
}

export function cancelUrl(): string {
  return `${brand.url}/panier?annule=1`;
}

export type { Stripe };
