import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { priceCart } from '@/lib/cart';
import { getStore, resetStore } from '@/lib/store';
import {
  createOrder, withStatus, withAddress, recordSupplierResult,
  isSupplierDone, isFullyForwarded, hasSentEmail, withEvent, generateOrderRef, toPublicOrder,
} from '@/lib/store/orders';
import { fulfillOrder } from '@/lib/fulfillment';
import type { ShippingAddress } from '@/lib/suppliers/types';
import type { Order } from '@/lib/store/types';

// Aucun fournisseur ni e-mail configure en test : les adaptateurs basculent en
// simulation et journalisent. On tait cette sortie pour garder un rapport lisible.
const quiet = { warn: vi.spyOn(console, 'warn').mockImplementation(() => {}) };
afterAll(() => quiet.warn.mockRestore());

const ADDRESS: ShippingAddress = {
  name: 'Camille Durand',
  line1: '12 rue des Lilas',
  line2: null,
  postalCode: '75011',
  city: 'Paris',
  country: 'FR',
  phone: null,
};

async function seedPaidOrder(productId = 'aria-6'): Promise<Order> {
  const cart = priceCart({
    lines: [{ productId, variantId: 'noir', quantity: 1 }],
    shippingCountry: 'FR',
    locale: 'fr',
  });
  let order = createOrder({ cart, email: 'client@exemple.fr', stripeSessionId: 'cs_test_1' });
  order = withStatus(order, 'paid');
  order = withAddress(order, ADDRESS);
  await getStore().save(order);
  return order;
}

beforeEach(() => {
  resetStore();
});

describe('traitement des commandes', () => {
  it('transmet une commande payee', async () => {
    const order = await seedPaidOrder();
    const outcome = await fulfillOrder(order.ref);

    expect(outcome.forwarded).toBe(true);
    expect(outcome.errors).toEqual([]);
    expect(outcome.order.status).toBe('forwarded');
    expect(outcome.order.supplierOrders).toHaveLength(1);
    expect(outcome.order.supplierOrders[0]!.status).toBe('ok');
  });

  it('ne transmet pas deux fois la même commande', async () => {
    // C’est LA garantie critique : Stripe rejoue ses webhooks, et une
    // double transmission signifie une double expédition payee deux fois.
    const order = await seedPaidOrder();

    const first = await fulfillOrder(order.ref);
    expect(first.forwarded).toBe(true);

    const second = await fulfillOrder(order.ref);
    expect(second.forwarded).toBe(false);
    expect(second.order.supplierOrders).toHaveLength(1);
  });

  it('n’envoie la confirmation qu’une seule fois', async () => {
    const order = await seedPaidOrder();
    const first = await fulfillOrder(order.ref);
    const sentOnce = first.order.events.filter((e) => e.type === 'email:confirmation_sent');
    expect(sentOnce).toHaveLength(1);

    await fulfillOrder(order.ref);
    const after = await getStore().get(order.ref);
    const sentTotal = after!.events.filter((e) => e.type === 'email:confirmation_sent');
    expect(sentTotal).toHaveLength(1);
  });

  it('transmet un appareil à son seul grossiste', async () => {
    const order = await seedPaidOrder('aria-6');
    const outcome = await fulfillOrder(order.ref);
    expect(outcome.order.supplierOrders).toHaveLength(1);
    expect(outcome.order.supplierOrders[0]!.supplier).toBe('eu-stoves');
  });

  it('répartit une commande entre plusieurs fournisseurs', async () => {
    const cart = priceCart({
      lines: [
        { productId: 'aria-6', variantId: 'noir', quantity: 1 },
        { productId: 'aspirateur-cendres', variantId: null, quantity: 1 },
      ],
      shippingCountry: 'FR',
      locale: 'fr',
    });
    let order = createOrder({ cart, email: 'client@exemple.fr', stripeSessionId: 'cs_test_2' });
    order = withAddress(withStatus(order, 'paid'), ADDRESS);
    await getStore().save(order);

    const outcome = await fulfillOrder(order.ref);
    const suppliers = outcome.order.supplierOrders.map((s) => s.supplier).sort();
    expect(suppliers).toEqual(['eu-flues', 'eu-stoves']);
    // Chaque fournisseur recoit une référence distincte, clé d’idempotence
    // de son cote.
    const refs = new Set(outcome.order.supplierOrders.map((s) => s.orderRef));
    expect(refs.size).toBe(2);
  });

  it('bascule en échec quand l’adresse manque', async () => {
    const cart = priceCart({
      lines: [{ productId: 'aria-6', variantId: 'noir', quantity: 1 }],
      shippingCountry: 'FR',
      locale: 'fr',
    });
    let order = createOrder({ cart, email: 'client@exemple.fr', stripeSessionId: 'cs_test_3' });
    order = withStatus(order, 'paid');
    await getStore().save(order);

    const outcome = await fulfillOrder(order.ref);
    expect(outcome.skipped).toBe('no_address');
    expect(outcome.order.status).toBe('fulfillment_failed');
  });

  it('leve une erreur explicite si la commande n’existe pas', async () => {
    await expect(fulfillOrder('PEL-INCONNU')).rejects.toThrow(/introuvable/);
  });

  it('empeche deux traitements concurrents', async () => {
    const order = await seedPaidOrder();
    // Lancees ensemble, une seule doit obtenir le verrou.
    const [a, b] = await Promise.all([fulfillOrder(order.ref), fulfillOrder(order.ref)]);
    const forwardedCount = [a, b].filter((o) => o.forwarded).length;
    expect(forwardedCount).toBe(1);
    expect([a.skipped, b.skipped]).toContain('locked');
  });
});

describe('état par fournisseur', () => {
  const base = (): Order => ({
    ref: 'PEL-TEST01', status: 'paid', createdAt: '', updatedAt: '', locale: 'fr',
    email: 'a@b.fr', lines: [], subtotal: 0, shippingPrice: 0, total: 0, vat: 0,
    currency: 'EUR', shippingLabel: 'x', address: ADDRESS, stripeSessionId: null,
    stripePaymentIntentId: null, supplierOrders: [], trackingNumber: null, carrier: null,
    events: [], fulfillmentAttempts: 0,
  });

  it('permet de reessayer uniquement le fournisseur en échec', () => {
    // Le bug qu’on previent : avec un simple tableau d’identifiants, une
    // commande partiellement transmise etait consideree comme terminee et
    // l’article manquant n’etait jamais commande.
    let order = base();
    order = recordSupplierResult(order, {
      supplier: 'eu-primary', orderRef: 'r1', supplierOrderId: 'ok1',
      status: 'ok', error: null, attempts: 0, lastAttemptAt: '',
    });
    order = recordSupplierResult(order, {
      supplier: 'pod-eu', orderRef: 'r2', supplierOrderId: null,
      status: 'failed', error: 'indisponible', attempts: 0, lastAttemptAt: '',
    });

    expect(isSupplierDone(order, 'eu-primary')).toBe(true);
    expect(isSupplierDone(order, 'pod-eu')).toBe(false);
    expect(isFullyForwarded(order, ['eu-flues', 'eu-stoves'])).toBe(false);
    expect(isFullyForwarded(order, ['eu-primary'])).toBe(true);
  });

  it('remplace l’enregistrement d’un fournisseur et compte les tentatives', () => {
    let order = base();
    order = recordSupplierResult(order, {
      supplier: 'pod-eu', orderRef: 'r2', supplierOrderId: null,
      status: 'failed', error: 'timeout', attempts: 0, lastAttemptAt: '',
    });
    order = recordSupplierResult(order, {
      supplier: 'pod-eu', orderRef: 'r2', supplierOrderId: 'ok2',
      status: 'ok', error: null, attempts: 0, lastAttemptAt: '',
    });

    expect(order.supplierOrders).toHaveLength(1);
    expect(order.supplierOrders[0]!.status).toBe('ok');
    expect(order.supplierOrders[0]!.attempts).toBe(2);
  });

  it('considere une liste vide comme non transmise', () => {
    expect(isFullyForwarded(base(), [])).toBe(false);
  });

  it('detecte un e-mail déjà envoye', () => {
    const order = withEvent(base(), 'email:confirmation_sent');
    expect(hasSentEmail(order, 'confirmation')).toBe(true);
    expect(hasSentEmail(order, 'shipping')).toBe(false);
  });
});

describe('références et vue publique', () => {
  it('genere des références lisibles au téléphone', () => {
    const refs = new Set(Array.from({ length: 400 }, () => generateOrderRef()));
    // Pas de collision sur 400 tirages.
    expect(refs.size).toBe(400);
    for (const ref of refs) {
      expect(ref).toMatch(/^PEL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      // Ni I, ni O, ni 0, ni 1 : pas d’ambiguite a la dictee.
      expect(ref.slice(4)).not.toMatch(/[IO01]/);
    }
  });

  it('masque les données personnelles dans la vue publique', () => {
    const cart = priceCart({
      lines: [{ productId: 'aria-6', variantId: 'noir', quantity: 1 }],
      shippingCountry: 'FR',
      locale: 'fr',
    });
    let order = createOrder({ cart, email: 'secret@exemple.fr', stripeSessionId: 'cs_x' });
    order = withAddress(order, ADDRESS);

    const serialized = JSON.stringify(toPublicOrder(order));
    expect(serialized).not.toContain('secret@exemple.fr');
    expect(serialized).not.toContain('12 rue des Lilas');
    expect(serialized).not.toContain('75011');
    expect(serialized).not.toContain('cs_x');
    // Mais la ville reste, elle rassure sans rien reveler.
    expect(serialized).toContain('Paris');
  });
});
