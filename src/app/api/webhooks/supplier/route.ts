/**
 * POST /api/webhooks/supplier
 *
 * Point d’entrée du suivi : le fournisseur annonce l’expédition, on enregistre
 * le numéro et on notifie le client. C’est le dernier maillon manuel supprime.
 *
 * Authentification par secret partage, compare en temps constant. Le format
 * des champs varie d’un grossiste a l’autre : plusieurs noms sont acceptes
 * pour éviter d’avoir a reecrire la route a chaque changement de fournisseur.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { attachTracking } from '@/lib/fulfillment';
import { getStore } from '@/lib/store';
import { withStatus } from '@/lib/store/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Comparaison en temps constant : une comparaison `===` fuit la longueur du
 * préfixe commun et permet de deviner le secret caractère par caractère.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const payloadSchema = z
  .object({
    reference: z.string().min(1).max(64).optional(),
    order_ref: z.string().min(1).max(64).optional(),
    tracking_number: z.string().min(1).max(128).optional(),
    tracking: z.string().min(1).max(128).optional(),
    carrier: z.string().max(64).nullish(),
    status: z.string().max(64).optional(),
  })
  .transform((raw) => ({
    ref: raw.reference ?? raw.order_ref ?? null,
    trackingNumber: raw.tracking_number ?? raw.tracking ?? null,
    carrier: raw.carrier ?? null,
    status: raw.status ?? null,
  }));

export async function POST(request: Request) {
  const expected = process.env.SUPPLIER_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'webhook fournisseur non configure' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-webhook-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'non autorise' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'corps illisible' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'charge utile invalide' }, { status: 400 });
  }

  const { ref, trackingNumber, carrier, status } = parsed.data;
  if (!ref) {
    return NextResponse.json({ error: 'référence de commande absente' }, { status: 400 });
  }

  // La référence peut être suffixée par fournisseur (VRS-ABC123-pod-eu) :
  // on retrouve la commande en retirant le suffixe.
  const baseRef = ref.replace(/-(eu-primary|pod-eu)$/, '');

  if (trackingNumber) {
    const order = await attachTracking(baseRef, trackingNumber, carrier);
    if (!order) {
      return NextResponse.json({ error: `commande ${baseRef} introuvable` }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ref: order.ref, status: order.status });
  }

  // Pas de numéro de suivi : on se contente de refléter le statut connu.
  if (status === 'delivered') {
    const store = getStore();
    const order = await store.get(baseRef);
    if (order) {
      await store.save(withStatus(order, 'delivered', 'confirme par le fournisseur'));
      return NextResponse.json({ ok: true, ref: order.ref, status: 'delivered' });
    }
  }

  return NextResponse.json({ ok: true, note: 'aucun changement applique' });
}
