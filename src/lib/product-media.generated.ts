/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 *
 * Produit par `npm run media:scan`, qui liste les photos réellement déposées
 * dans `public/img/products/<id-produit>/`. Tant qu'un produit n'a pas de
 * dossier, le site affiche l'illustration de substitution déclarée dans le
 * catalogue.
 *
 * La résolution de chaque fichier est mesurée et inscrite ici : c'est elle qui
 * borne la taille d'affichage, pour qu'une petite image reste nette au lieu
 * d'être étirée. `null` pour un SVG, qui n'a pas de résolution.
 */

export interface GeneratedImage {
  readonly src: string;
  readonly width: number | null;
  readonly height: number | null;
}

export const generatedMedia: Record<string, readonly GeneratedImage[]> = {
  'anna-12': [
    { src: '/img/products/anna-12/01-produit.webp', width: 800, height: 800 },
    { src: '/img/products/anna-12/02-ambiance.webp', width: 800, height: 800 },
    { src: '/img/products/anna-12/03-bandeau-commande.webp', width: 800, height: 800 },
    { src: '/img/products/anna-12/04-telecommande.webp', width: 800, height: 800 },
    { src: '/img/products/anna-12/05-etiquette-energie.webp', width: 800, height: 800 },
  ],
  'vertigo-up': [
    { src: '/img/products/vertigo-up/01-produit.webp', width: 800, height: 800 },
    { src: '/img/products/vertigo-up/02-ambiance-noir.webp', width: 800, height: 800 },
    { src: '/img/products/vertigo-up/03-sortie-dessus.webp', width: 800, height: 800 },
    { src: '/img/products/vertigo-up/04-ambiance-salon.webp', width: 800, height: 800 },
  ],
};
