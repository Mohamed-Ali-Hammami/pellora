/**
 * Modèle économique de la boutique.
 *
 * Ce module existe pour une seule raison : répondre par le calcul, et non par
 * une promesse, a la question « est-ce que ca peut rapporter X par mois ? ».
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
 * Tous les montants sont en euros (nombres réels) : ce module sert a
 * simuler, pas a facturer. La facturation, elle, est en centimes entiers
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
  /** Commission du prestataire de paiement (0,015 = 1,5 %). */
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
 * Jeu d’hypothèses de départ pour la niche café filtre.
 *
 * ATTENTION — ce sont des HYPOTHÈSES, pas des mesures. Je n’ai pas de source
 * vérifiée pour le CPC ni pour le taux de conversion de cette niche a la date
 * d’aujourd’hui : ces deux nombres doivent être remplaces par vos propres
 * données dès que vous avez dépensé vos premiers 300 a 500 € de publicité.
 * Ce sont aussi les deux variables qui pèsent le plus sur le résultat.
 */
export const baselineInputs: EconomicsInputs = {
  aov: 92,
  vatRate: 0.2,
  cogsPerOrder: 29,
  supplierShippingPerOrder: 5.9,
  shippingChargedPerOrder: 1.6,
  paymentFeeRate: 0.015,
  paymentFeeFixed: 0.25,
  refundRate: 0.04,
  cpc: 0.7,
  conversionRate: 0.02,
  fixedCostsMonthly: 420,
  ordersPerCustomerPerYear: 1.35,
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
  /** CAC maximal avant de travailler a perte. */
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
        `${u.cac.toFixed(2)} € a acquérir : le modèle perd ${Math.abs(u.contributionAfterAds).toFixed(2)} € ` +
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

/** Panier moyen minimal pour atteindre l’objectif a volume et conversion donnes. */
export function requiredAov(
  i: EconomicsInputs,
  profitTarget: number,
  ordersPerMonth: number,
): number {
  // Résolution numérique : la TVA, les commissions et les retours dépendent
  // tous de l’AOV, une inversion analytique serait illisible.
  let low = 0;
  let high = 1000;
  for (let step = 0; step < 80; step += 1) {
    const mid = (low + high) / 2;
    const profit = monthlyPlanForOrders({ ...i, aov: mid }, ordersPerMonth).profitMonthly;
    if (profit < profitTarget) low = mid;
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
 * mensuel correspondant, a volume de commandes constant.
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
