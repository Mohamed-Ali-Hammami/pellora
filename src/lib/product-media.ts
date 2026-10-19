/**
 * Résolution des visuels produit.
 *
 * Problème à résoudre : les photographies arrivent après la mise en place du
 * site, par lots, et sans qu'on veuille toucher au code à chaque livraison de
 * visuels. Le catalogue déclare donc une illustration de substitution, et ce
 * module la remplace automatiquement dès que de vraies photos existent.
 *
 * Mode d'emploi :
 *   1. déposer les fichiers dans `public/img/products/<id-produit>/`
 *      (01.jpg, 02.jpg… l'ordre alphabétique fait l'ordre d'affichage) ;
 *   2. lancer `npm run media:scan` ;
 *   3. c'est tout — le site sert les photos au lieu des illustrations.
 *
 * Les formats acceptés sont .jpg, .jpeg, .png, .webp, .avif et .svg.
 *
 * Point juridique volontairement rappelé ici : n'utilisez que des visuels
 * dont l'usage vous est concédé — media pack du fournisseur, vos propres
 * photos, ou banque d'images sous licence commerciale. Une photo trouvée via
 * un moteur de recherche reste protégée par le droit d'auteur, et la facture
 * rétroactive d'une agence dépasse largement le prix d'un visuel acheté.
 */

import { generatedMedia } from './product-media.generated';
import type { Product, ProductImage } from './catalog.types';
import type { Locale } from './i18n/config';

/** Visuels à afficher pour un produit : photos réelles si présentes, sinon illustrations. */
export function resolveImages(product: Product): readonly ProductImage[] {
  const real = generatedMedia[product.id];
  if (!real || real.length === 0) return product.images;

  // L'alternative textuelle du catalogue décrit l'appareil : elle reste
  // valable pour une photo du même appareil, et vaut mieux qu'un `alt` vide.
  const fallbackAlt = product.images[0]?.alt;

  return real.map((src, index) => ({
    src,
    alt: fallbackAlt ?? {
      fr: `${product.name} — vue ${index + 1}`,
      en: `${product.name} — view ${index + 1}`,
      nl: `${product.name} — weergave ${index + 1}`,
      es: `${product.name} — vista ${index + 1}`,
    },
    placeholder: false,
  }));
}

/** Visuel principal — celui des cartes produit et des aperçus de partage. */
export function primaryImage(product: Product): ProductImage {
  const images = resolveImages(product);
  return (
    images[0] ?? {
      src: '/img/placeholder/stove-air.svg',
      alt: { fr: product.name, en: product.name, nl: product.name, es: product.name },
      placeholder: true,
    }
  );
}

/** `true` si le produit n'a encore que des illustrations : déclenche la mention. */
export function hasOnlyPlaceholders(product: Product): boolean {
  return resolveImages(product).every((image) => image.placeholder);
}

/** URL absolue d'un visuel, pour Open Graph et les données structurées. */
export function absoluteImageUrl(src: string, siteUrl: string): string {
  return src.startsWith('http') ? src : `${siteUrl}${src}`;
}

export function altFor(image: ProductImage, locale: Locale): string {
  return image.alt[locale];
}
