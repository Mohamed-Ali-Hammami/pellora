/**
 * POST /api/webhooks/stripe
 *
 * Déclencheur de toute l’automatisation : Stripe confirme le paiement, on
 * traite la commande.
 *
 * Trois exigences incontournables :
 *
 *   1. VERIFIER LA SIGNATURE. Sans cela, l’URL est publique et n’importe qui
 *      peut poster un faux `checkout.session.completed` pour déclencher une
 *      expédition gratuite. On lit donc le corps BRUT (`request.text()`) :
 *      `request.json()` reserialise et invalide la signature.
 *   2. REPONDRE VITE. Stripe considère la livraison en échec au-delà de
 *      ~20 s et rejoue l’événement. Le traitement reste court ; les
 *      opérations longues sont rattrapées par `/api/cron/reconcile`.
 *   3. ETRE IDEMPOTENT. Stripe rejoue ses événements. `fulfillOrder` pose un
 *      verrou et vérifié l’état par fournisseur avant d’agir.
 */

import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getStore } from '@/lib/store';
import { withStatus, withAddress, withEvent } from '@/lib/store/orders';
import { fulfillOrder } from '@/lib/fulfillment';
import { alertOps } from '@/lib/email/send';
import type { ShippingAddress } from '@/lib/suppliers/types';
import type { Stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractAddress(session: Stripe.Checkout.Session): ShippingAddress | null {
  const collected = session.collected_information?.shipping_details;
  const détails = collected ?? null;
  if (!détails?.address) return null;

  const a = détails.address;
  if (!a.line1 || !a.postal_code || !a.city || !a.country) return null;

  return {
    name: détails.name ?? session.customer_details?.name ?? '',
    line1: a.line1,
    line2: a.line2 ?? null,
    postalCode: a.postal_code,
    city: a.city,
    country: a.country,
    phone: session.customer_details?.phone ?? null,
  };
}

async function resolveOrderRef(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMetadata = session.metadata?.['order_ref'];
  if (fromMetadata) return fromMetadata;
  if (session.client_reference_id) return session.client_reference_id;
  const found = await getStore().findByStripeSession(session.id);
  return found?.ref ?? null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook:stripe] STRIPE_WEBHOOK_SECRET absente — événement refuse');
    return NextResponse.json({ error: 'webhook non configure' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'signature absente' }, { status: 400 });
  }

  // Corps BRUT : indispensable pour que la signature reste valide.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    // Variante asynchrone : fonctionne aussi sur les environnements dont la
    // cryptographie n’est disponible qu’en asynchrone (Edge, Workers).
    event = await getStripe().webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    console.warn('[webhook:stripe] signature invalide', error);
    return NextResponse.json({ error: 'signature invalide' }, { status: 400 });
  }

  const store = getStore();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const ref = await resolveOrderRef(session);
        if (!ref) {
          await alertOps(
            'Paiement sans commande rattachée',
            `Session ${session.id} payée mais aucune référence de commande trouvée. ` +
              `A rapprocher manuellement dans le tableau de bord Stripe.`,
          );
          break;
        }

        const order = await store.get(ref);
        if (!order) {
          await alertOps(
            `Commande ${ref} introuvable après paiement`,
            `La session ${session.id} est payée mais la commande n’est pas dans le magasin. ` +
              `Persistance (UPSTASH_*) probablement absente.`,
          );
          break;
        }

        // `payment_status` peut valoir `unpaid` sur un paiement diffère :
        // ne rien expédier avant encaissement effectif.
        if (session.payment_status !== 'paid') {
          await store.save(
            withEvent(order, 'stripe:awaiting_payment', `statut ${session.payment_status}`),
          );
          break;
        }

        const address = extractAddress(session);
        let updated = withStatus(order, 'paid', `session ${session.id}`);
        updated = {
          ...updated,
          email: session.customer_details?.email ?? order.email,
          stripePaymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        };
        if (address) updated = withAddress(updated, address);
        await store.save(updated);

        // Traitement immédiat. En cas d’échec, la commande passe en
        // `fulfillment_failed` et le rattrapage planifie la reprend.
        await fulfillOrder(ref);
        break;
      }

      case 'checkout.session.expired': {
        const ref = await resolveOrderRef(event.data.object);
        const order = ref ? await store.get(ref) : null;
        if (order && order.status === 'pending') {
          await store.save(withStatus(order, 'cancelled', 'session de paiement expirée'));
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const ref = charge.metadata?.['order_ref'];
        const order = ref ? await store.get(ref) : null;
        if (order) {
          await store.save(
            withStatus(order, 'refunded', `rembourse ${charge.amount_refunded / 100} €`),
          );
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object;
        await alertOps(
          'Contestation de paiement ouverte',
          `Litige ${dispute.id} sur ${dispute.amount / 100} € — motif « ${dispute.reason} ». ` +
            `Répondez dans Stripe avant la date limite, preuves de livraison a l’appui.`,
        );
        break;
      }

      default:
        // Les autres événements sont acquittes sans traitement : répondre 2xx
        // évite que Stripe les rejoue indéfiniment.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook:stripe] échec de traitement de ${event.type}`, error);
    // 500 => Stripe rejouera. L’idempotence rend ce rejeu sans danger.
    return NextResponse.json({ error: 'traitement en échec' }, { status: 500 });
  }
}
