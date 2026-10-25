/**
 * Configuration de l'enseigne.
 *
 * Tout ce qui est propre à la marque vit ici. Changer de nom commercial, de
 * domaine ou d'adresse de support = éditer ce fichier, rien d'autre.
 *
 * Les champs réglementaires (raison sociale, SIREN, TVA, adresse, hébergeur)
 * sont lus depuis l'environnement : ils diffèrent selon l'entité qui exploite
 * la boutique, et ils doivent être exacts avant toute vente — les mentions
 * légales et les CGV s'appuient dessus.
 */

import { L, type Localized } from './i18n/config';

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/** Marque le contenu réglementaire encore à compléter, pour l'afficher comme tel. */
export const LEGAL_PLACEHOLDER = '—';

export const brand = {
  name: 'Pellora',
  domain: 'pellora.eu',
  url: env('NEXT_PUBLIC_SITE_URL', 'https://pellora.eu'),

  tagline: L(
    'Le chauffage au granulé, bien dimensionné.',
    'Pellet heating, correctly sized.',
    'Pelletverwarming, juist gedimensioneerd.',
    'Calefacción de pellets, bien dimensionada.',
  ),

  pitch: L(
    "Poêles hydro et poêles à air ventilé sélectionnés un par un, livrés depuis l'Union européenne avec le dimensionnement fait avant l'achat.",
    'Hydro and ducted-air pellet stoves selected one by one, shipped from within the European Union, with the sizing done before you buy.',
    'Hydro- en ventilatiekachels op pellets, één voor één geselecteerd, verzonden vanuit de Europese Unie, met de berekening vóór uw aankoop.',
    'Estufas de pellets hidro y de aire ventilado seleccionadas una por una, enviadas desde la Unión Europea, con el cálculo hecho antes de comprar.',
  ),

  email: {
    support: env('SUPPORT_EMAIL', 'contact@pellora.eu'),
    orders: env('ORDERS_EMAIL', 'commandes@pellora.eu'),
    /** Expéditeur. Avec Gmail, ce doit être l'adresse du compte SMTP, sinon le message est rejeté. */
    from: env('EMAIL_FROM', 'Pellora <contact@pellora.eu>'),
  },

  phone: env('SUPPORT_PHONE', LEGAL_PLACEHOLDER),

  /** Pays d'établissement : détermine le droit applicable cité dans les CGV. */
  country: 'FR',

  /**
   * Identité de l'exploitant. À renseigner AVANT la première vente : l'absence
   * de ces mentions est sanctionnée en France (art. 6 III LCEN) et dans l'UE
   * (directive 2011/83/UE sur les droits des consommateurs).
   */
  legal: {
    entity: env('LEGAL_ENTITY', LEGAL_PLACEHOLDER),
    form: env('LEGAL_FORM', LEGAL_PLACEHOLDER),
    capital: env('LEGAL_CAPITAL', LEGAL_PLACEHOLDER),
    registration: env('LEGAL_REGISTRATION', LEGAL_PLACEHOLDER),
    vatNumber: env('LEGAL_VAT_NUMBER', LEGAL_PLACEHOLDER),
    address: env('LEGAL_ADDRESS', LEGAL_PLACEHOLDER),
    director: env('LEGAL_DIRECTOR', LEGAL_PLACEHOLDER),
    host: env('LEGAL_HOST', 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA'),
    /** Médiateur de la consommation — obligatoire en France (art. L.612-1 code de la consommation). */
    mediator: env('LEGAL_MEDIATOR', LEGAL_PLACEHOLDER),
  },

  social: {
    instagram: env('SOCIAL_INSTAGRAM', ''),
    youtube: env('SOCIAL_YOUTUBE', ''),
    facebook: env('SOCIAL_FACEBOOK', ''),
  },
} as const;

export type Brand = typeof brand;

/** `true` quand une mention réglementaire est encore à compléter. */
export function isLegalPlaceholder(value: string): boolean {
  return value === LEGAL_PLACEHOLDER || value.trim().length === 0;
}

/** `true` si l'identité de l'exploitant est complète — contrôle avant lancement. */
export function hasCompleteLegalIdentity(): boolean {
  return (
    !isLegalPlaceholder(brand.legal.entity) &&
    !isLegalPlaceholder(brand.legal.registration) &&
    !isLegalPlaceholder(brand.legal.address)
  );
}

/**
 * Engagements affichés en bandeau. Ils doivent rester littéralement vrais :
 * une promesse de livraison non tenue est la première cause de litige et de
 * rétrofacturation sur ce type de produit.
 */
export const promises: readonly { title: Localized<string>; detail: Localized<string> }[] = [
  {
    title: L('Dimensionnement avant achat', 'Sizing before purchase', 'Berekening vóór aankoop', 'Cálculo antes de comprar'),
    detail: L(
      'Calculateur de puissance, et un humain pour vérifier',
      'Power calculator, plus a human to check it',
      'Vermogenscalculator, met menselijke controle',
      'Calculadora de potencia y revisión humana',
    ),
  },
  {
    title: L('Expédié depuis l’UE', 'Shipped from the EU', 'Verzonden vanuit de EU', 'Enviado desde la UE'),
    detail: L(
      'Entrepôts UE — pas de douane, pas de délai surprise',
      'EU warehouses — no customs, no surprise delays',
      'EU-opslag — geen douane, geen verrassingen',
      'Almacenes en la UE — sin aduana ni retrasos',
    ),
  },
  {
    title: L('Livraison sur rendez-vous', 'Delivery by appointment', 'Levering op afspraak', 'Entrega con cita previa'),
    detail: L(
      'Camion hayon, créneau convenu par téléphone',
      'Tail-lift truck, slot agreed by phone',
      'Vrachtwagen met laadlift, telefonisch afgesproken',
      'Camión con plataforma, franja acordada por teléfono',
    ),
  },
  {
    title: L('Paiement par virement', 'Payment by transfer', 'Betaling per overschrijving', 'Pago por transferencia'),
    detail: L(
      'Aucune donnée bancaire à saisir sur le site',
      'No card details to enter on the site',
      'Geen bankgegevens in te voeren op de site',
      'Ningún dato bancario que introducir en el sitio',
    ),
  },
];
