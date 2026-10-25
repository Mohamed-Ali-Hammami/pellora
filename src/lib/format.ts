/**
 * Formatage localisé.
 *
 * Toujours passer par ces fonctions plutôt que par `Intl` directement : le
 * mapping langue → locale BCP 47 est défini à un seul endroit, et l'anglais
 * de cette boutique facture en euros, pas en dollars.
 */

import { intlLocales, type Locale } from './i18n/config';
import { CURRENCY, formatPrice as formatPriceRaw, type Cents } from './money';

export function price(amount: Cents, locale: Locale): string {
  return formatPriceRaw(amount, { locale: intlLocales[locale], currency: CURRENCY });
}

/** Prix sans décimales quand le montant est rond : « 1 290 € » plutôt que « 1 290,00 € ». */
export function priceShort(amount: Cents, locale: Locale): string {
  const whole = amount % 100 === 0;
  return new Intl.NumberFormat(intlLocales[locale], {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export function date(iso: string, locale: Locale): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocales[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function dateShort(value: Date | string, locale: Locale): string {
  const parsed = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(intlLocales[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function decimal(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(intlLocales[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function integer(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocales[locale], { maximumFractionDigits: 0 }).format(value);
}

/** Puissance en kW, avec l'unité — « 6,2 kW » / « 6.2 kW ». */
export function kilowatts(value: number, locale: Locale): string {
  return `${decimal(value, locale, 1)} kW`;
}

/**
 * Rend une plage de valeurs, ou un simple maximum quand la borne basse n'est
 * pas connue : « 2,1 – 6,2 kW » d'un côté, « Jusqu'à 90 m² » de l'autre.
 *
 * Exister sous cette forme évite la tentation d'inventer une borne basse pour
 * satisfaire un gabarit d'affichage — sur une caractéristique réglementée,
 * c'est exactement ce qu'il ne faut pas faire.
 */
export function rangeOrMax(
  min: number | null,
  max: number,
  unit: string,
  locale: Locale,
  upToLabel: string,
  digits = 1,
): string {
  const render = (value: number) => (digits > 0 ? decimal(value, locale, digits) : integer(value, locale));
  return min === null
    ? `${upToLabel} ${render(max)} ${unit}`
    : `${render(min)} – ${render(max)} ${unit}`;
}

/** Remplace les jetons `{clef}` d'un texte du dictionnaire. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  // Les nombres sont acceptés tels quels : obliger chaque appelant à les
  // convertir n'ajoutait rien et finissait par produire des `String(x)`
  // dispersés, dont certains oubliés.
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
