/**
 * Orchestrateur de traitement — SERVEUR UNIQUEMENT.
 *
 * C’est la pièce qui rend la boutique « automatisée de A à Z » : une fois le
 * paiement confirme, elle éclate la commande en lignes fournisseur, les
 * regroupe par grossiste, transmet, enregistre et notifie — sans intervention.
 *
 * Trois garanties, dans cet ordre d’importance :
 *
 *   1. IDEMPOTENCE. Stripe rejoue ses webhooks (nouvelle tentative, incident
 *      réseau, double livraison). Une commande transmise deux fois est
 *      expédiée deux fois et payée deux fois. On verrouille, puis on vérifié
 *      l’état de la commande avant d’agir.
 *   2. PAS DE PERTE SILENCIEUSE. Un échec fournisseur fait passer la commande
 *      en `fulfillment_failed`, déclenche une alerte et reste dans la file de
 *      rattrapage. Le client a payé : l’échec ne peut pas rester invisible.
 *   3. L’E-MAIL CLIENT PASSE AVANT LE FOURNISSEUR. Un client sans
 *      confirmation croit avoir perdu son argent et conteste le paiement ;
 *      un fournisseur qui reçoit la commande dix minutes plus tard ne change
 *      rien. On confirme donc d’abord, on transmet ensuite.
 */

import { explodeToSupplierLines, maxLeadTimeDays } from './sourcing';
import { getSupplier } from './suppliers';
import { getStore } from './store';
import {
  withStatus,
  withEvent,
  isSupplierDone,
  isFullyForwarded,
  hasSentEmail,
  recordSupplierResult,
} from './store/orders';
import { sendRawEmail, alertOps } from './email/send';
import { orderConfirmation, shippingNotification } from './email/templates';
import { getProductById } from './catalog';
import { formatPrice } from './money';
import type { Order } from './store/types';
import type { SupplierOrderLine } from './suppliers/types';

export const MAX_FULFILLMENT_ATTEMPTS = 4;

/** Verrou pose le temps du traitement : plus long que l’appel fournisseur. */
const LOCK_TTL_SECONDS = 120;

export interface FulfillmentOutcome {
  order: Order;
  forwarded: boolean;
  skipped: 'already_forwarded' | 'locked' | 'no_address' | null;
  errors: string[];
}

/** Regroupe les articles par fournisseur : une commande par grossiste, pas une par article. */
function groupBySupplier(order: Order): Map<string, SupplierOrderLine[]> {
  const grouped = new Map<string, SupplierOrderLine[]>();
  for (const line of order.lines) {
    for (const exploded of explodeToSupplierLines(line.productId, line.quantity)) {
      const bucket = grouped.get(exploded.supplier) ?? [];
      // Fusionne les références identiques venant de lots différents.
      const existing = bucket.find((l) => l.supplierSku === exploded.supplierSku);
      if (existing) existing.quantity += exploded.quantity;
      else
        bucket.push({
          supplierSku: exploded.supplierSku,
          quantity: exploded.quantity,
          name: getProductById(exploded.productId)?.name ?? exploded.productId,
        });
      grouped.set(exploded.supplier, bucket);
    }
  }
  return grouped;
}

/**
 * Traite une commande payée. Sans effet sur ce qui a déjà abouti.
 */
export async function fulfillOrder(ref: string): Promise<FulfillmentOutcome> {
  const store = getStore();

  // (1) Verrou d’abord : deux webhooks simultanés ne doivent pas se croiser.
  const locked = await store.acquireLock(`fulfill:${ref}`, LOCK_TTL_SECONDS);
  if (!locked) {
    const existing = await store.get(ref);
    return {
      order: existing ?? ({ ref } as Order),
      forwarded: false,
      skipped: 'locked',
      errors: [],
    };
  }

  const order = await store.get(ref);
  if (!order) {
    await alertOps(
      'Commande introuvable au traitement',
      `La référence ${ref} n’existe pas dans le magasin. ` +
        `Cause probable : persistance non configurée (variables UPSTASH_*) ou commande expirée.`,
    );
    throw new Error(`commande introuvable : ${ref}`);
  }

  const grouped = groupBySupplier(order);
  const suppliers = [...grouped.keys()];

  // (2) Garde-fou métier, en plus du verrou : couvre le rejeu arrive après
  // l’expiration du verrou.
  if (isFullyForwarded(order, suppliers)) {
    return { order, forwarded: false, skipped: 'already_forwarded', errors: [] };
  }

  if (!order.address) {
    const updated = withStatus(order, 'fulfillment_failed', 'aucune adresse de livraison');
    await store.save(updated);
    await alertOps(
      `Commande ${ref} sans adresse`,
      `Paiement encaisse (${formatPrice(order.total)}) mais aucune adresse de livraison. ` +
        `A traiter manuellement : contacter ${order.email}.`,
    );
    return { order: updated, forwarded: false, skipped: 'no_address', errors: ['adresse manquante'] };
  }

  // Capture après la garde : `current` est réassigné plusieurs fois ensuite,
  // ce qui ferait perdre le narrowing de `address` à TypeScript.
  const address = order.address;
  let current = order;

  // (3) Confirmation client avant le fournisseur : un client sans
  // confirmation croit avoir perdu son argent et conteste le paiement, alors
  // qu’un fournisseur servi dix minutes plus tard ne change rien.
  // `hasSentEmail` évite de renvoyer la confirmation à chaque rattrapage.
  if (!hasSentEmail(current, 'confirmation')) {
    const confirmation = orderConfirmation(current);
    const mail = await sendRawEmail({
      to: current.email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
    current = mail.ok
      ? withEvent(current, 'email:confirmation_sent')
      : withEvent(current, 'email:confirmation_failed', mail.error);
    if (!mail.ok) {
      await alertOps(
        `Confirmation non envoyée — ${ref}`,
        `Le client ${current.email} n’a pas reçu sa confirmation : ${mail.error}`,
      );
    }
  }

  // (4) Transmission, fournisseur par fournisseur, en sautant ceux qui ont
  // déjà abouti lors d’une tentative précédenté.
  const errors: string[] = [];
  let newlyForwarded = 0;

  for (const [supplierId, lines] of grouped) {
    if (isSupplierDone(current, supplierId)) continue;

    const supplier = getSupplier(supplierId);
    // Référence stable d’une tentative à l’autre : c’est la clé
    // d’idempotence cote grossiste.
    const orderRef = suppliers.length > 1 ? `${current.ref}-${supplierId}` : current.ref;
    const at = new Date().toISOString();

    const result = await supplier.placeOrder({
      orderRef,
      lines,
      address,
      email: current.email,
      shippingMethod: current.shippingLabel,
      note: `Commande ${current.ref}`,
    });

    if (result.ok) {
      newlyForwarded += 1;
      current = recordSupplierResult(current, {
        supplier: supplierId,
        orderRef,
        supplierOrderId: result.supplierOrderId,
        status: 'ok',
        error: null,
        attempts: 0,
        lastAttemptAt: at,
      });
      current = withEvent(current, 'supplier:ordered', `${supplier.label} — ${result.supplierOrderId}`);
      if (result.trackingNumber) {
        current = { ...current, trackingNumber: result.trackingNumber, carrier: result.carrier };
      }
    } else {
      errors.push(`${supplier.label} : ${result.error}`);
      current = recordSupplierResult(current, {
        supplier: supplierId,
        orderRef,
        supplierOrderId: null,
        status: 'failed',
        error: result.error,
        attempts: 0,
        lastAttemptAt: at,
      });
      current = withEvent(
        current,
        result.retryable ? 'supplier:failed_retryable' : 'supplier:failed_permanent',
        result.error,
      );
    }
  }

  current = { ...current, fulfillmentAttempts: current.fulfillmentAttempts + 1 };

  if (errors.length === 0) {
    const lead = maxLeadTimeDays(current.lines.map((l) => l.productId));
    current = withStatus(current, 'forwarded', `préparation annoncée : ${lead} j ouvrés`);
  } else {
    current = withStatus(current, 'fulfillment_failed', errors.join(' | '));
    await alertOps(
      `Transmission en échec — ${current.ref} (tentative ${current.fulfillmentAttempts})`,
      [
        `Commande : ${current.ref}`,
        `Client   : ${current.email}`,
        `Montant  : ${formatPrice(current.total)}`,
        '',
        'Erreurs :',
        ...errors.map((e) => `  - ${e}`),
        '',
        current.fulfillmentAttempts >= MAX_FULFILLMENT_ATTEMPTS
          ? 'LIMITE DE TENTATIVES ATTEINTE — intervention manuelle requise.'
          : 'Un rattrapage automatique est planifie.',
      ].join('\n'),
    );
  }

  await store.save(current);

  return { order: current, forwarded: errors.length === 0 && newlyForwarded > 0, skipped: null, errors };
}

/**
 * Enregistre un numéro de suivi et notifie le client.
 * Appelé par le webhook fournisseur ou par le rattrapage planifie.
 */
export async function attachTracking(
  ref: string,
  trackingNumber: string,
  carrier: string | null,
): Promise<Order | null> {
  const store = getStore();
  const order = await store.get(ref);
  if (!order) return null;

  // Ne pas renotifier si le numéro est inchangé : les webhooks fournisseur
  // sont souvent émis plusieurs fois pour le même événement.
  if (order.trackingNumber === trackingNumber) return order;

  const updated: Order = {
    ...withEvent(order, 'tracking:received', `${carrier ?? 'transporteur'} ${trackingNumber}`),
    trackingNumber,
    carrier,
    status: 'shipped',
  };

  let final = updated;
  if (!hasSentEmail(updated, 'shipping')) {
    const message = shippingNotification(updated);
    const mail = await sendRawEmail({
      to: updated.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    final = mail.ok
      ? withEvent(updated, 'email:shipping_sent')
      : withEvent(updated, 'email:shipping_failed', mail.error);
  }

  await store.save(final);
  return final;
}

/**
 * Rattrapage : réessaie les commandes en échec.
 * Déclenche par `/api/cron/reconcile`.
 */
export async function retryFailedOrders(limit = 25): Promise<{
  attempted: number;
  recovered: number;
  exhausted: string[];
}> {
  const store = getStore();
  const failed = await store.listFailed(limit);

  let recovered = 0;
  const exhausted: string[] = [];

  for (const order of failed) {
    if (order.fulfillmentAttempts >= MAX_FULFILLMENT_ATTEMPTS) {
      exhausted.push(order.ref);
      continue;
    }
    // Le verrou de la tentative précédente a expiré depuis longtemps.
    const outcome = await fulfillOrder(order.ref).catch(() => null);
    if (outcome?.forwarded) recovered += 1;
  }

  return { attempted: failed.length, recovered, exhausted };
}
