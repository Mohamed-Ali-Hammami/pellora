/**
 * Arithmétique monétaire.
 *
 * Règle absolue du projet : un montant est TOUJOURS un entier de centimes
 * (`Cents`). Aucun prix ne transite jamais en nombre flottant : `0.1 + 0.2`
 * vaut `0.30000000000000004`, ce qui finit par produire des écarts d’un
 * centime entre le panier, Stripe et la comptabilité.
 *
 * Convention TVA : tous les prix catalogue sont exprimes TTC (taxe incluse),
 * comme l’exige l’affichage au consommateur en France / UE. La TVA est donc
 * *extraite* du prix, jamais ajoutée par-dessus.
 */

export type Cents = number;

export const CURRENCY = 'EUR' as const;

/** Taux de TVA applique par défaut (France, taux normal). */
export const DEFAULT_VAT_RATE = 0.2;

export function assertCents(value: number, label = 'montant'): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} doit être un entier de centimes, reçu : ${value}`);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`${label} doit être fini, reçu : ${value}`);
  }
  return value;
}

/** Construit des centimes depuis un montant en euros (ex. 89.9 -> 8990). */
export function euros(amount: number): Cents {
  return Math.round(amount * 100);
}

/** Arrondi commercial au centime (demi vers le haut, symétrique autour de 0). */
export function roundCents(value: number): Cents {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function multiply(amount: Cents, quantity: number): Cents {
  assertCents(amount, 'montant');
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`quantité invalide : ${quantity}`);
  }
  return amount * quantity;
}

export function sum(amounts: readonly Cents[]): Cents {
  return amounts.reduce<Cents>((acc, a) => acc + assertCents(a), 0);
}

/** Applique un pourcentage de remise (ex. 10 pour -10 %). */
export function applyPercentOff(amount: Cents, percent: number): Cents {
  assertCents(amount);
  if (percent < 0 || percent > 100) {
    throw new Error(`pourcentage de remise invalide : ${percent}`);
  }
  return roundCents(amount * (1 - percent / 100));
}

/**
 * Décompose un montant TTC en base hors taxe + TVA.
 * La TVA est calculée comme le résidu pour que `net + vat === gross` toujours.
 */
export function splitVatInclusive(
  gross: Cents,
  rate: number = DEFAULT_VAT_RATE,
): { net: Cents; vat: Cents; gross: Cents } {
  assertCents(gross, 'montant TTC');
  if (rate < 0 || rate >= 1) {
    throw new Error(`taux de TVA invalide : ${rate}`);
  }
  const net = roundCents(gross / (1 + rate));
  return { net, vat: gross - net, gross };
}

/** Formatage pour affichage. `locale`/`currency` restent surchargeables. */
export function formatPrice(
  amount: Cents,
  { locale = 'fr-FR', currency = CURRENCY }: { locale?: string; currency?: string } = {},
): string {
  assertCents(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

/** Pourcentage d’économie entre un prix barre et un prix de vente. */
export function savingsPercent(compareAt: Cents, price: Cents): number {
  assertCents(compareAt);
  assertCents(price);
  if (compareAt <= 0 || price >= compareAt) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
