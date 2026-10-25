/**
 * Données d'approvisionnement — SERVEUR UNIQUEMENT.
 *
 * Contient les prix d'achat et les références grossiste. Ces informations
 * ne doivent jamais arriver dans le bundle navigateur : un concurrent qui lit
 * vos coûts d'achat connaît votre marge et votre fournisseur.
 *
 * Trois protections se cumulent :
 *   1. la garde d'exécution ci-dessous (échec immédiat et bruyant) ;
 *   2. `tests/leakage.test.ts`, qui refuse tout import depuis un composant client ;
 *   3. la revue de code — ce fichier ne s'importe que depuis `src/app/api/**`
 *      ou un module lui-même serveur.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'sourcing.ts a été importé côté client : les prix d’achat fuiraient dans le bundle. ' +
      'Déplacez cet import vers une route API ou un composant serveur.',
  );
}

import { euros, type Cents } from './money';
import { products, getProductById } from './catalog';

export interface SourcingLine {
  /** Référence du produit chez le grossiste : ce qu'on écrit sur le bon de commande. */
  supplierSku: string;
  /** Prix d'achat unitaire HT, port exclu. */
  costNet: Cents;
  /** Délai de préparation annoncé par le fournisseur, en jours ouvrés. */
  leadTimeDays: number;
  /** Coût du transport amont payé au fournisseur, par unité. */
  inboundShipping: Cents;
}

/**
 * ATTENTION — ces coûts sont des HYPOTHÈSES DE TRAVAIL, pas des tarifs
 * négociés. Ils donnent un ordre de grandeur plausible pour un grossiste
 * européen de poêles à granulés (marge brute visée : 28 à 35 % sur les
 * appareils, 45 à 55 % sur les accessoires), mais ils doivent être remplacés
 * par vos vrais tarifs avant toute décision : toute la rentabilité du site
 * dépend de ces nombres, et une erreur de 100 € sur un coût d'achat suffit à
 * transformer une commande rentable en commande à perte.
 *
 * Le transport amont est séparé du coût marchandise : sur un appareil de
 * 200 kg il représente 40 à 90 € et il est trop lourd pour être noyé dans un
 * prix d'achat moyen.
 */
export const sourcing: Record<string, SourcingLine> = {
  // PROVISOIRE — ETNA Luxe Anna 12EC. Ni la référence grossiste, ni le prix
  // d'achat, ni le transport amont ne sont négociés : ces trois nombres
  // doivent venir de votre tarif ETNA avant la première vente.
  'anna-12': { supplierSku: 'ETNA-ANNA-12EC', costNet: euros(1450), leadTimeDays: 3, inboundShipping: euros(62) },
  // PROVISOIRE — ETNA Vertigo Up. Même réserve que pour l'Anna : référence
  // grossiste, prix d'achat et transport amont restent à négocier.
  'vertigo-up': { supplierSku: 'ETNA-VERTIGO-UP', costNet: euros(1520), leadTimeDays: 3, inboundShipping: euros(64) },
  // PROVISOIRE — ETNA Vulcano Silenzio Up.
  'vulcano-silenzio-up': { supplierSku: 'ETNA-VULCANO-SIL-UP', costNet: euros(1460), leadTimeDays: 3, inboundShipping: euros(62) },
  'aria-6': { supplierSku: 'IT-ARIA-06N', costNet: euros(742), leadTimeDays: 2, inboundShipping: euros(48) },
  'aria-9-canal': { supplierSku: 'IT-ARIA-09C', costNet: euros(1118), leadTimeDays: 2, inboundShipping: euros(56) },
  'vela-8-slim': { supplierSku: 'IT-VELA-08S', costNet: euros(1205), leadTimeDays: 3, inboundShipping: euros(52) },
  'aria-12-duo': { supplierSku: 'IT-ARIA-12D', costNet: euros(1376), leadTimeDays: 3, inboundShipping: euros(64) },
  'idro-12-compact': { supplierSku: 'IT-IDRO-12C', costNet: euros(1592), leadTimeDays: 3, inboundShipping: euros(72) },
  'idro-15': { supplierSku: 'IT-IDRO-15', costNet: euros(1854), leadTimeDays: 3, inboundShipping: euros(78) },
  'idro-20-ecs': { supplierSku: 'IT-IDRO-20S', costNet: euros(2310), leadTimeDays: 4, inboundShipping: euros(88) },
  'idro-24-plus': { supplierSku: 'IT-IDRO-24P', costNet: euros(2584), leadTimeDays: 5, inboundShipping: euros(96) },
  'kit-conduit-80': { supplierSku: 'PL-FLUE-80K4', costNet: euros(152), leadTimeDays: 2, inboundShipping: euros(18) },
  'thermostat-wifi': { supplierSku: 'CN-THW-210', costNet: euros(52), leadTimeDays: 1, inboundShipping: euros(4) },
  'aspirateur-cendres': { supplierSku: 'PL-ASH-20L', costNet: euros(34), leadTimeDays: 1, inboundShipping: euros(7) },
  'granules-palette': { supplierSku: 'FR-PEL-DIN1T', costNet: euros(286), leadTimeDays: 3, inboundShipping: euros(42) },
};

/** Coût d'achat marchandise d'un produit, HT, transport amont exclu. */
export function costOf(productId: string): Cents {
  const line = sourcing[productId];
  if (!line) {
    if (!getProductById(productId)) throw new Error(`produit inconnu : ${productId}`);
    throw new Error(`aucun coût d’achat défini pour « ${productId} »`);
  }
  return line.costNet;
}

/** Coût de revient complet d'une unité : marchandise + transport amont. */
export function landedCostOf(productId: string): Cents {
  const line = sourcing[productId];
  if (!line) throw new Error(`aucun coût d’achat défini pour « ${productId} »`);
  return line.costNet + line.inboundShipping;
}

/**
 * Marge brute en centimes sur une unité vendue au prix catalogue.
 * Le prix catalogue est TTC : on en retire la TVA avant de comparer à un
 * coût HT, sinon la marge affichée est fausse de 20 %.
 */
export function grossMarginOf(productId: string, vatRate = 0.2): Cents {
  const product = getProductById(productId);
  if (!product) throw new Error(`produit inconnu : ${productId}`);
  const netRevenue = Math.round(product.price / (1 + vatRate));
  return netRevenue - landedCostOf(productId);
}

/** Délai de préparation le plus long de la commande — base de la date annoncée. */
export function maxLeadTimeDays(productIds: readonly string[]): number {
  const leadTimes = productIds.map((id) => sourcing[id]?.leadTimeDays ?? 3);
  return leadTimes.length === 0 ? 3 : Math.max(...leadTimes);
}

/** Vérifie que chaque produit du catalogue a un coût calculable. */
export function assertSourcingComplete(): void {
  const missing = products.filter((product) => !sourcing[product.id]).map((p) => p.id);
  if (missing.length > 0) {
    throw new Error(`coût d’achat manquant pour : ${missing.join(', ')}`);
  }
}
