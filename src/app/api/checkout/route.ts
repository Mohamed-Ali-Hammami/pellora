/**
 * POST /api/checkout
 *
 * Reçoit un panier (identifiants + quantités uniquement), le CHIFFRE COTE
 * SERVEUR, crée la commande en attente, puis ouvre une session Stripe Checkout.
 *
 * Point de sécurité central : le corps de la requête ne contient aucun prix.
 * Si le client pouvait envoyer un montant, il suffirait de le modifier dans la
 * console du navigateur pour payer un centime. Les prix sont donc toujours
 * relus dans le catalogue par `priceCart`.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { cartInputSchema, priceCart, CartError } from '@/lib/cart';
import { isShippableCountry } from '@/lib/shipping';
import {
  getStripe,
  isStripeConfigured,
  cartToLineItems,
  cartToShippingOptions,
  allowedShippingCountries,
  successUrl,
  cancelUrl,
} from '@/lib/stripe';
import { getStore } from '@/lib/store';
import { createOrder } from '@/lib/store/orders';
import { brand } from '@/lib/brand';

export const runtime = 'nodejs';
/** Jamais de mise en cache : chaque appel crée une commande. */
export const dynamic = 'force-dynamic';

/** Expiration de la session de paiement : 30 min, le minimum accepte par Stripe. */
const SESSION_TTL_SECONDS = 30 * 60;

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Le paiement n’est pas encore configure sur cette boutique.' },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  try {
    const input = cartInputSchema.parse(payload);

    if (!isShippableCountry(input.shippingCountry)) {
      return NextResponse.json(
        { error: `Nous ne livrons pas encore en « ${input.shippingCountry} ».` },
        { status: 400 },
      );
    }

    // Seul calcul de prix autorise.
    const cart = priceCart(input);

    const order = createOrder({ cart, email: '', stripeSessionId: null });
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: cartToLineItems(cart),
      shipping_options: cartToShippingOptions(cart),
      shipping_address_collection: { allowed_countries: allowedShippingCountries },
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      customer_creation: 'always',
      locale: 'fr',
      success_url: successUrl(),
      cancel_url: cancelUrl(),
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      client_reference_id: order.ref,
      // La référence voyage dans les deux sens : le webhook retrouve la
      // commande par ce champ, sans dépendre d’un index externe.
      metadata: { order_ref: order.ref },
      payment_intent_data: {
        metadata: { order_ref: order.ref },
        description: `${brand.name} — commande ${order.ref}`,
      },
      // Les frais de port sont déjà dans `shipping_options` : ne pas activer
      // `automatic_tax`, qui recalculerait une TVA par-dessus des prix TTC.
    });

    await getStore().save({ ...order, stripeSessionId: session.id });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe n’a pas renvoyé d’URL de paiement.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url, ref: order.ref });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Panier invalide.', détails: error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }
    if (error instanceof CartError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[checkout] échec', error);
    return NextResponse.json(
      { error: 'Impossible d’ouvrir le paiement. Réessayez dans un instant.' },
      { status: 500 },
    );
  }
}
