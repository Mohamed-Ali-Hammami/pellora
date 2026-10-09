/**
 * Magasin Redis (Upstash) — production.
 *
 * Choisi pour une raison précise : l’API est en HTTP, donc utilisable depuis
 * un environnement serverless sans pool de connexions, et les verrous
 * d’idempotence s’obtiennent en une commande atomique (`SET NX`).
 */

import { Redis } from '@upstash/redis';
import type { Order, OrderStore } from './types';

const KEY_ORDER = (ref: string) => `order:${ref}`;
const KEY_SESSION = (sessionId: string) => `session:${sessionId}`;
const KEY_FAILED = 'orders:failed';
const KEY_LOCK = (key: string) => `lock:${key}`;

/** Conservation : 3 ans, pour couvrir l’obligation comptable française. */
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 365 * 3;

export function createRedisStore(): OrderStore {
  const redis = Redis.fromEnv();

  return {
    async get(ref) {
      return (await redis.get<Order>(KEY_ORDER(ref))) ?? null;
    },

    async save(order) {
      await redis.set(KEY_ORDER(order.ref), order, { ex: ORDER_TTL_SECONDS });
      if (order.stripeSessionId) {
        await redis.set(KEY_SESSION(order.stripeSessionId), order.ref, { ex: ORDER_TTL_SECONDS });
      }
      // La file des échecs sert au travail de rattrapage planifie.
      if (order.status === 'fulfillment_failed') {
        await redis.lpush(KEY_FAILED, order.ref);
      }
    },

    async findByStripeSession(sessionId) {
      const ref = await redis.get<string>(KEY_SESSION(sessionId));
      return ref ? this.get(ref) : null;
    },

    async acquireLock(key, ttlSeconds) {
      // `SET key 1 NX EX ttl` : atomique, donc deux webhooks simultanés ne
      // peuvent pas obtenir le verrou tous les deux.
      const result = await redis.set(KEY_LOCK(key), '1', { nx: true, ex: ttlSeconds });
      return result === 'OK';
    },

    async listFailed(limit) {
      const refs = await redis.lrange<string>(KEY_FAILED, 0, limit - 1);
      const orders = await Promise.all(refs.map((ref) => this.get(ref)));
      return orders.filter((o): o is Order => o !== null && o.status === 'fulfillment_failed');
    },
  };
}
