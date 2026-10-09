/**
 * Configuration de la marque. Tout ce qui est spécifique à l’enseigne est ici :
 * changer de niche = éditer ce fichier + `catalog.ts` + `sourcing.ts`,
 * sans toucher au reste du code.
 */

export const brand = {
  name: 'Verseuse',
  legalName: 'VERSEUSE',
  tagline: 'Le café filtre, fait correctement.',
  pitch:
    "Des outils d’infusion manuelle choisis un par un, expédiés depuis l’Union européenne en 2 à 4 jours.",
  domain: 'verseuse.fr',
  // Mettre à jour avant la mise en production (variable NEXT_PUBLIC_SITE_URL en priorité).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://verseuse.fr',
  email: {
    support: 'bonjour@verseuse.fr',
    orders: 'commandes@verseuse.fr',
    // Expéditeur vérifié dans Resend. Doit être un domaine dont vous avez les DNS.
    from: process.env.EMAIL_FROM ?? 'Verseuse <bonjour@verseuse.fr>',
  },
  locale: 'fr-FR',
  country: 'FR',
  social: {
    instagram: 'https://instagram.com/',
    tiktok: 'https://tiktok.com/',
  },
  /** Promesses affichées en bandeau : elles doivent rester littéralement vraies. */
  promises: [
    { title: 'Expédié depuis l’UE', detail: 'Entrepôt Pays-Bas — 2 à 4 jours ouvrés' },
    { title: 'Retour sous 30 jours', detail: 'Au-delà des 14 jours légaux' },
    { title: 'Paiement sécurisé', detail: 'Stripe — CB, Apple Pay, Google Pay' },
    { title: 'Conseil humain', detail: 'Réponse sous 24 h ouvrées' },
  ],
} as const;

export type Brand = typeof brand;
