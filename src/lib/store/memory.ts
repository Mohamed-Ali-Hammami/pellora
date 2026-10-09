/**
 * Magasin en mémoire — développement et tests uniquement.
 *
 * Les données disparaissent au redémarrage du processus, et chaque instance
 * serverless a la sienne. En production, configurez Redis (cf. `redis.ts`) :
 * `getStore()` émet un avertissement si ce n’est pas le cas.
 */

import type { Order, OrderStore } from './types';

export function createMemoryStore(): OrderStore {
  const orders = new Map<string, Order>();
  const bySession = new Map<string, string>();
  const locks = new Map<string, number>();

  return {
    async get(ref) {
      return orders.get(ref) ?? null;
    },
    async save(order) {
      orders.set(order.ref, order);
      if (order.stripeSessionId) bySession.set(order.stripeSessionId, order.ref);
    },
    async findByStripeSession(sessionId) {
      const ref = bySession.get(sessionId);
      return ref ? orders.get(ref) ?? null : null;
    },
    async acquireLock(key, ttlSeconds) {
      const now = Date.now();
      const expiry = locks.get(key);
      if (expiry !== undefined && expiry > now) return false;
      locks.set(key, now + ttlSeconds * 1000);
      return true;
    },
    async listFailed(limit) {
      return [...orders.values()]
        .filter((o) => o.status === 'fulfillment_failed')
        .slice(0, limit);
    },
  };
}
