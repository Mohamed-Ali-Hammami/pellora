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

/**
 * Le magasin est accroché à `globalThis`, et non à une variable de module.
 *
 * Next découpe le serveur en plusieurs bundles : une route d'API et un
 * composant serveur n'exécutent pas la même copie de ce fichier. Une variable
 * de module donnait donc UN MAGASIN MÉMOIRE PAR BUNDLE — une commande créée
 * par `/api/orders` restait invisible depuis `/admin`, qui affichait « aucune
 * commande » en toute bonne foi. Le symptôme imitait à s'y méprendre une
 * persistance mal configurée, ce qui est le pire des faux coupables.
 *
 * `globalThis` est partagé par tous les bundles d'un même processus. Cela ne
 * remplace pas Redis — un second processus, ou un redémarrage, repart de
 * zéro — mais cela rend le parcours complet essayable sans rien installer.
 */
const CLEF = Symbol.for('pellora.store');

interface Global {
  [CLEF]?: OrderStore;
}

export function getStore(): OrderStore {
  const racine = globalThis as Global;
  const store = racine[CLEF];
  if (store) return store;

  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );

  if (hasRedis) {
    // `createRedisStore` n’établit la connexion qu’ici : importer le module
    // sans l’appeler n’a aucun effet.
    racine[CLEF] = createRedisStore();
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[magasin] AUCUNE PERSISTANCE CONFIGUREE EN PRODUCTION. ' +
          'Les commandes seront perdues au redémarrage et le suivi client ne fonctionnera pas. ' +
          'Définissez UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN.',
      );
    }
    racine[CLEF] = createMemoryStore();
  }

  return racine[CLEF];
}

/** Reinitialisation, pour les tests. */
export function resetStore(): void {
  delete (globalThis as Global)[CLEF];
}

export type { Order, OrderStore, OrderStatus, OrderLine } from './types';
