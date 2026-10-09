/**
 * Données d’approvisionnement — SERVEUR UNIQUEMENT.
 *
 * Contient les prix d’achat et les références fournisseur. Ces informations
 * ne doivent jamais arriver dans le bundle navigateur : un concurrent qui lit
 * vos coûts d’achat connaît votre marge et votre fournisseur.
 *
 * Trois protections se cumulent :
 *   1. la garde d’exécution ci-dessous (échec immédiat et bruyant) ;
 *   2. `tests/leakage.test.ts`, qui refuse tout import depuis un composant client ;
 *   3. la revue de code — ce fichier ne s’importe que depuis `src/app/api/**`
 *      ou un module lui-même serveur.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'sourcing.ts a été importé côté client : les prix d’achat fuiraient dans le bundle. ' +
      'Déplacez cet import vers une route API ou un composant serveur.',
  );
}

import { euros } from './money';
import { products, getProductById } from './catalog';
import type { Cents } from './money';

export interface SourcingLine {
  /** Référence du produit chez le fournisseur, transmise telle quelle a sa commande. */
  supplierSku: string;
  /** Prix d’achat unitaire HT, port exclu. */
  costNet: Cents;
  /** Identifiant du fournisseur (cf. `suppliers/`). */
  supplier: string;
  /** Délai de préparation annonce par le fournisseur, en jours ouvrés. */
  leadTimeDays: number;
}

/**
 * ATTENTION — les coûts ci-dessous sont des HYPOTHÈSES de travail, pas des
 * tarifs négociés. Ils donnent un ordre de grandeur réaliste pour un
 * grossiste européen, mais ils doivent être remplaces par vos vrais tarifs
 * avant toute décision : toute la rentabilité du site dépend de ces nombres.
 */
export const sourcing: Record<string, SourcingLine> = {
  'dripper-ceramique': { supplierSku: 'EU-DRP-C02', costNet: euros(7.8), supplier: 'eu-primary', leadTimeDays: 1 },
  'verseuse-600': { supplierSku: 'EU-CRF-600', costNet: euros(9.5), supplier: 'eu-primary', leadTimeDays: 1 },
  'balance-precision': { supplierSku: 'EU-SCL-01T', costNet: euros(12.0), supplier: 'eu-primary', leadTimeDays: 1 },
  'filtre-inox': { supplierSku: 'EU-FLT-INX', costNet: euros(3.2), supplier: 'eu-primary', leadTimeDays: 1 },
  'moulin-precision': { supplierSku: 'EU-GRD-38C', costNet: euros(26.0), supplier: 'eu-primary', leadTimeDays: 2 },
  'bouilloire-col-cygne': { supplierSku: 'EU-KTL-900', costNet: euros(16.0), supplier: 'eu-primary', leadTimeDays: 2 },
  'french-press': { supplierSku: 'EU-FRP-350', costNet: euros(9.0), supplier: 'eu-primary', leadTimeDays: 1 },
  'kit-voyage': { supplierSku: 'EU-TRV-SET', costNet: euros(17.0), supplier: 'eu-primary', leadTimeDays: 2 },
  'carnet-degustation': { supplierSku: 'POD-NTB-60', costNet: euros(4.5), supplier: 'pod-eu', leadTimeDays: 3 },
};

/**
 * Coût d’achat d’un produit. Pour un lot, c’est la somme des composants :
 * un lot n’a pas de référence propre chez le fournisseur, il est expédié
 * comme autant de lignes distinctes.
 */
export function costOf(productId: string): Cents {
  const direct = sourcing[productId];
  if (direct) return direct.costNet;

  const product = getProductById(productId);
  if (!product) throw new Error(`produit inconnu : ${productId}`);
  if (product.bundleOf.length === 0) {
    throw new Error(`aucun coût d’achat défini pour « ${productId} » et ce n’est pas un lot`);
  }
  return product.bundleOf.reduce<Cents>((acc, id) => acc + costOf(id), 0);
}

/**
 * Développe un produit en lignes fournisseur expédiables.
 * Un lot est aplati récursivement en ses composants.
 */
export function explodeToSupplierLines(
  productId: string,
  quantity: number,
): { supplierSku: string; supplier: string; quantity: number; productId: string }[] {
  const direct = sourcing[productId];
  if (direct) {
    return [{ supplierSku: direct.supplierSku, supplier: direct.supplier, quantity, productId }];
  }
  const product = getProductById(productId);
  if (!product) throw new Error(`produit inconnu : ${productId}`);
  return product.bundleOf.flatMap((id) => explodeToSupplierLines(id, quantity));
}

/** Délai de préparation le plus long de la commande — base de la date de livraison annoncée. */
export function maxLeadTimeDays(productIds: readonly string[]): number {
  const leadTimes = productIds.flatMap((id) =>
    explodeToSupplierLines(id, 1).map((l) => sourcing[l.productId]?.leadTimeDays ?? 2),
  );
  return leadTimes.length === 0 ? 2 : Math.max(...leadTimes);
}

/** Vérifié au démarrage que chaque produit du catalogue a un coût calculable. */
export function assertSourcingComplete(): void {
  const missing: string[] = [];
  for (const product of products) {
    try {
      costOf(product.id);
    } catch {
      missing.push(product.id);
    }
  }
  if (missing.length > 0) {
    throw new Error(`coût d’achat manquant pour : ${missing.join(', ')}`);
  }
}
