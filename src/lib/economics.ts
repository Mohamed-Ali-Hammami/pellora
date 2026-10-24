/**
 * Modèle économique de la boutique.
 *
 * Ce module existe pour une seule raison : répondre par le calcul, et non par
 * une promesse, à la question « est-ce que ca peut rapporter X par mois ? ».
 *
 * L’identité qui décide de tout :
 *
 *     CAC = CPC / taux de conversion
 *
 * Un coût par clic de 0,70 € avec 2 % de conversion donne un coût
 * d’acquisition de 35 €. Aucune astuce de site ne contourne cette division :
 * on agit soit sur le CPC (ciblage, créas), soit sur la conversion (fiche
 * produit, prix, réassurance), soit sur la marge par commande (panier moyen).
 *
 * Tous les montants sont en euros (nombres réels) : ce module sert à
 * simuler, pas à facturer. La facturation, elle, est en centimes entiers
 * (cf. `money.ts`).
 */

export interface EconomicsInputs {
  /** Panier moyen TTC, en euros. */
  aov: number;
  /** Taux de TVA applique (0,2 = 20 %). */
  vatRate: number;
  /** Coût d’achat marchandise moyen par commande, HT. */
  cogsPerOrder: number;
  /** Port paye au fournisseur par commande. */
  supplierShippingPerOrder: number;
  /** Part des frais de port refacturee au client (moyenne, TTC). */
  shippingChargedPerOrder: number;
  /**
   * Commission du prestataire de paiement (0,015 = 1,5 %).
   *
   * Nulle en paiement par virement : il n'y a pas de prestataire. Le champ
   * reste dans le modèle pour pouvoir chiffrer ce que coûterait l'ajout d'un
   * paiement par carte — c'est précisément l'arbitrage que ce nombre sert à
   * éclairer.
   */
  paymentFeeRate: number;
  /** Part fixe de la commission de paiement, par transaction. */
  paymentFeeFixed: number;
  /** Taux de retour / remboursement (0,04 = 4 %). */
  refundRate: number;
  /** Coût par clic publicitaire moyen. */
  cpc: number;
  /** Taux de conversion visite -> commande (0,02 = 2 %). */
  conversionRate: number;
  /** Charges fixes mensuelles : abonnements, domaine, comptable, outils. */
  fixedCostsMonthly: number;
  /** Nombre de commandes par client et par an (1 = aucun reachat). */
  ordersPerCustomerPerYear: number;
}

/**
 * Jeu d'hypothèses de départ pour la niche poêles à granulés.
 *
 * ATTENTION — ce sont des HYPOTHÈSES, pas des mesures. Je n'ai pas de source
 * vérifiée pour le CPC ni pour le taux de conversion de cette niche à la date
 * d'aujourd'hui : ces deux nombres doivent être remplacés par vos propres
 * données dès vos premiers 500 à 1 000 € de publicité. Ce sont aussi les deux
 * variables qui pèsent le plus sur le résultat.
 *
 * Ce qui change par rapport à une niche à petit panier, et qu'il faut avoir
 * en tête avant de lire les sorties :
 *
 *  - le panier moyen est élevé (environ 1 900 €), donc la marge par commande
 *    est confortable ET le CAC supportable est élevé ;
 *  - mais le cycle de décision est long : on n'achète pas un poêle de 2 000 €
 *    à la première visite. Le taux de conversion est donc nettement plus bas
 *    que sur un produit d'impulsion, et le CPC plus cher parce que les
 *    installateurs et les grandes enseignes enchérissent sur les mêmes mots ;
 *  - un retour coûte très cher (90 à 180 € de transport palette, plus le
 *    risque d'avarie), d'où un taux de remboursement qui pèse lourd ;
 *  - le réachat existe mais porte sur le combustible et les accessoires, pas
 *    sur un second appareil : d'où `ordersPerCustomerPerYear` à peine
 *    supérieur à 1.
 */
export const baselineInputs: EconomicsInputs = {
  aov: 1900,
  vatRate: 0.2,
  cogsPerOrder: 1180,
  supplierShippingPerOrder: 68,
  shippingChargedPerOrder: 52,
  // Virement bancaire : aucune commission. Un virement SEPA entrant est
  // gratuit sur un compte professionnel courant.
  paymentFeeRate: 0,
  paymentFeeFixed: 0,
  refundRate: 0.03,
  cpc: 1.4,
  conversionRate: 0.006,
  fixedCostsMonthly: 540,
  ordersPerCustomerPerYear: 1.15,
};

export interface UnitEconomics {
  /** CA TTC encaisse par commande. */
  grossPerOrder: number;
  /** CA hors taxe (la TVA n’est pas un revenu : elle est reversée). */
  netPerOrder: number;
  cogs: number;
  supplierShipping: number;
  paymentFees: number;
  refundCost: number;
  /** Marge avant publicité. C’est le plafond absolu du CAC supportable. */
  contributionBeforeAds: number;
  /** Coût d’acquisition implique par le CPC et la conversion. */
  cac: number;
  /** Marge après publicité, par commande. */
  contributionAfterAds: number;
  /** Marge brute en % du CA HT. */
  grossMarginPct: number;
  /** CAC maximal avant de travailler à perte. */
  breakEvenCac: number;
}

export function computeUnitEconomics(i: EconomicsInputs): UnitEconomics {
  const grossPerOrder = i.aov;
  const netPerOrder = grossPerOrder / (1 + i.vatRate);
  const paymentFees = grossPerOrder * i.paymentFeeRate + i.paymentFeeFixed;

  // Un remboursement coûte la marge de la commande plus le port aller :
  // la marchandise revient souvent invendable ou non revendue.
  const marginIfKept =
    netPerOrder - i.cogsPerOrder - i.supplierShippingPerOrder - paymentFees;
  const refundCost = i.refundRate * (marginIfKept + i.supplierShippingPerOrder);

  const contributionBeforeAds = marginIfKept - refundCost;
  const cac = i.conversionRate > 0 ? i.cpc / i.conversionRate : Number.POSITIVE_INFINITY;

  return {
    grossPerOrder,
    netPerOrder,
    cogs: i.cogsPerOrder,
    supplierShipping: i.supplierShippingPerOrder,
    paymentFees,
    refundCost,
    contributionBeforeAds,
    cac,
    contributionAfterAds: contributionBeforeAds - cac,
    grossMarginPct: netPerOrder > 0 ? ((netPerOrder - i.cogsPerOrder) / netPerOrder) * 100 : 0,
    breakEvenCac: contributionBeforeAds,
  };
}

export interface MonthlyPlan {
  ordersPerMonth: number;
  ordersPerDay: number;
  sessionsPerMonth: number;
  adSpendMonthly: number;
  revenueMonthlyGross: number;
  revenueMonthlyNet: number;
  contributionMonthly: number;
  fixedCosts: number;
  /** Résultat d’exploitation avant impôt. */
  profitMonthly: number;
  /** Marge nette en % du CA TTC. */
  netMarginPct: number;
}

export function monthlyPlanForOrders(i: EconomicsInputs, ordersPerMonth: number): MonthlyPlan {
  const u = computeUnitEconomics(i);
  const sessionsPerMonth = i.conversionRate > 0 ? ordersPerMonth / i.conversionRate : Infinity;
  const adSpendMonthly = sessionsPerMonth * i.cpc;
  const contributionMonthly = u.contributionBeforeAds * ordersPerMonth;
  const profitMonthly = contributionMonthly - adSpendMonthly - i.fixedCostsMonthly;
  const revenueMonthlyGross = i.aov * ordersPerMonth;

  return {
    ordersPerMonth,
    ordersPerDay: ordersPerMonth / 30.4,
    sessionsPerMonth,
    adSpendMonthly,
    revenueMonthlyGross,
    revenueMonthlyNet: revenueMonthlyGross / (1 + i.vatRate),
    contributionMonthly,
    fixedCosts: i.fixedCostsMonthly,
    profitMonthly,
    netMarginPct: revenueMonthlyGross > 0 ? (profitMonthly / revenueMonthlyGross) * 100 : 0,
  };
}

export type TargetVerdict =
  | { reachable: true; plan: MonthlyPlan }
  | { reachable: false; reason: string; breakEvenCac: number; cac: number };

/**
 * Combien de commandes mensuelles pour atteindre un objectif de bénéfice ?
 *
 * Renvoie explicitement « inatteignable » quand la marge par commande ne
 * couvre pas le coût d’acquisition : dans ce cas, aucun volume ne sauve le
 * modèle — chaque commande supplémentaire creuse la perte. C’est le piège
 * numéro un du dropshipping, et il est arithmétique, pas psychologique.
 */
export function ordersNeededFor(i: EconomicsInputs, profitTarget: number): TargetVerdict {
  const u = computeUnitEconomics(i);

  if (u.contributionAfterAds <= 0) {
    return {
      reachable: false,
      reason:
        `Chaque commande laisse ${u.contributionBeforeAds.toFixed(2)} € de marge mais coûte ` +
        `${u.cac.toFixed(2)} € à acquérir : le modèle perd ${Math.abs(u.contributionAfterAds).toFixed(2)} € ` +
        `par vente. Augmenter le volume aggrave la perte. Il faut agir sur le panier moyen, ` +
        `le coût d’achat, le CPC ou la conversion — pas sur le budget publicitaire.`,
      breakEvenCac: u.breakEvenCac,
      cac: u.cac,
    };
  }

  const orders = (profitTarget + i.fixedCostsMonthly) / u.contributionAfterAds;
  return { reachable: true, plan: monthlyPlanForOrders(i, Math.ceil(orders)) };
}

/** Taux de conversion minimal pour atteindre l’objectif, les autres paramètres figes. */
export function requiredConversionRate(
  i: EconomicsInputs,
  profitTarget: number,
  ordersPerMonth: number,
): number | null {
  const u = computeUnitEconomics({ ...i, conversionRate: 1 });
  const contributionTotal = u.contributionBeforeAds * ordersPerMonth;
  const adBudgetAvailable = contributionTotal - i.fixedCostsMonthly - profitTarget;
  if (adBudgetAvailable <= 0) return null;
  // adSpend = (orders / cr) * cpc  =>  cr = orders * cpc / adSpend
  return (ordersPerMonth * i.cpc) / adBudgetAvailable;
}

/** Panier moyen minimal pour atteindre l’objectif à volume et conversion donnes. */
export function requiredAov(
  i: EconomicsInputs,
  profitTarget: number,
  ordersPerMonth: number,
): number {
  /*
   * Résolution numérique : la TVA, les commissions et les retours dépendent
   * tous de l'AOV, une inversion analytique serait illisible.
   *
   * La borne haute est CHERCHÉE et non figée. Une borne constante est un piège
   * silencieux : si l'AOV nécessaire la dépasse, la dichotomie renvoie la
   * borne elle-même, c'est-à-dire un nombre qui n'atteint pas l'objectif,
   * présenté comme s'il l'atteignait. Sur une niche à panier élevé, l'erreur
   * passe inaperçue et fausse toute la décision.
   */
  const profitAt = (aov: number): number =>
    monthlyPlanForOrders({ ...i, aov }, ordersPerMonth).profitMonthly;

  let high = Math.max(100, i.aov * 2);
  // 1 M€ de panier moyen : au-delà, l'objectif n'est pas atteignable par le
  // panier, et le dire vaut mieux que de rendre un nombre arbitraire.
  const CEILING = 1_000_000;
  while (profitAt(high) < profitTarget) {
    high *= 2;
    if (high > CEILING) return Number.POSITIVE_INFINITY;
  }

  let low = 0;
  for (let step = 0; step < 80; step += 1) {
    const mid = (low + high) / 2;
    if (profitAt(mid) < profitTarget) low = mid;
    else high = mid;
  }
  return high;
}

/** Valeur client sur 12 mois : les reachats ne coûtent pas de CAC. */
export function customerLifetimeValue(i: EconomicsInputs): number {
  const u = computeUnitEconomics(i);
  return u.contributionBeforeAds * i.ordersPerCustomerPerYear - u.cac;
}

/**
 * Analyse de sensibilité : fait varier un paramètre et renvoie le bénéfice
 * mensuel correspondant, à volume de commandes constant.
 */
export function sensitivity<K extends keyof EconomicsInputs>(
  i: EconomicsInputs,
  key: K,
  values: readonly number[],
  ordersPerMonth: number,
): { value: number; profit: number }[] {
  return values.map((value) => ({
    value,
    profit: monthlyPlanForOrders({ ...i, [key]: value }, ordersPerMonth).profitMonthly,
  }));
}
