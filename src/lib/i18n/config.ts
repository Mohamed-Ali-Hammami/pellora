/**
 * Socle d'internationalisation.
 *
 * Choix d'architecture : pas de dépendance i18n externe. Le site a quatre
 * langues connues à la compilation et des textes écrits à la main — un
 * dictionnaire typé donne la même garantie qu'une bibliothèque (une clé
 * manquante devient une erreur TypeScript) sans ajouter de runtime, et sans
 * dépendre d'une API susceptible de changer de version.
 *
 * Règle du projet : AUCUN texte visible n'est écrit en dur dans un composant.
 * Tout passe par le dictionnaire ou par un champ `Localized` du catalogue.
 */

export const locales = ['fr', 'en', 'nl', 'es'] as const;

export type Locale = (typeof locales)[number];

/** Langue servie quand aucune préférence exploitable n'est exprimée. */
export const defaultLocale: Locale = 'fr';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Nom de la langue dans sa propre langue — jamais traduit. */
export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  nl: 'Nederlands',
  es: 'Español',
};

/** Étiquette courte pour le sélecteur compact. */
export const localeShortNames: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
  nl: 'NL',
  es: 'ES',
};

/**
 * Locale BCP 47 utilisée pour `Intl` (prix, dates, nombres).
 * `en-IE` et non `en-US` : la boutique facture en euros et livre dans l'UE,
 * donc l'anglais doit formater « €1,290.00 » avec les conventions irlandaises
 * plutôt que d'afficher un symbole dollar mal placé.
 */
export const intlLocales: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-IE',
  nl: 'nl-NL',
  es: 'es-ES',
};

/** Valeur de l'attribut `lang` du document. */
export const htmlLangs: Record<Locale, string> = {
  fr: 'fr',
  en: 'en',
  nl: 'nl',
  es: 'es',
};

/** Format attendu par Open Graph (`og:locale`). */
export const ogLocales: Record<Locale, string> = {
  fr: 'fr_FR',
  en: 'en_IE',
  nl: 'nl_NL',
  es: 'es_ES',
};

/**
 * Code de langue de la page de paiement Stripe. Les quatre langues du site
 * font partie des locales supportées par Stripe Checkout ; en cas de doute
 * Stripe accepte `auto`, mais on préfère imposer la langue déjà choisie par
 * le visiteur pour ne pas casser la continuité du parcours.
 */
export const stripeLocales: Record<Locale, 'fr' | 'en' | 'nl' | 'es'> = {
  fr: 'fr',
  en: 'en',
  nl: 'nl',
  es: 'es',
};

/** Un contenu décliné dans les quatre langues. */
export type Localized<T> = Record<Locale, T>;

/** Lit la valeur d'un champ localisé. */
export function pick<T>(value: Localized<T>, locale: Locale): T {
  return value[locale];
}

/**
 * Raccourci d'écriture pour les contenus localisés du catalogue.
 * L'ordre des arguments est toujours fr, en, nl, es.
 */
export function L(fr: string, en: string, nl: string, es: string): Localized<string> {
  return { fr, en, nl, es };
}

/** Valeur identique dans les quatre langues (unités, dimensions, références). */
export function U(value: string): Localized<string> {
  return { fr: value, en: value, nl: value, es: value };
}

/**
 * Négocie la langue depuis un en-tête `Accept-Language`.
 * Implémentation volontairement courte : on cherche la première langue
 * supportée par ordre de préférence décroissant, en ignorant la région
 * (`nl-BE` doit servir le néerlandais).
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const quality = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return {
        language: (tag ?? '').trim().toLowerCase().split('-')[0] ?? '',
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.language.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.language)) return entry.language;
  }
  return defaultLocale;
}
