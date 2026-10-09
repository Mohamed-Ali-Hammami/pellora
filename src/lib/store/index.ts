/**
 * Point d’accès unique au magasin de commandes.
 *
 * Bascule automatique : Redis si configure, mémoire sinon. Le choix est
 * journalise une seule fois, assez bruyamment pour qu’on ne mette pas en
 * production sans persistance par inadvertance.
 */

import type { OrderStore } from './types';
import { createMemoryStore } from './memory';
import { createRedisStore } from './redis';

let store: OrderStore | null = null;

export function getStore(): OrderStore {
  if (store) return store;

  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );

  if (hasRedis) {
    // `createRedisStore` n’établit la connexion qu’ici : importer le module
    // sans l’appeler n’a aucun effet.
    store = createRedisStore();
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[magasin] AUCUNE PERSISTANCE CONFIGUREE EN PRODUCTION. ' +
          'Les commandes seront perdues au redémarrage et le suivi client ne fonctionnera pas. ' +
          'Définissez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN.',
      );
    }
    store = createMemoryStore();
  }

  return store;
}

/** Reinitialisation, pour les tests. */
export function resetStore(): void {
  store = null;
}

export type { Order, OrderStore, OrderStatus, OrderLine } from './types';
