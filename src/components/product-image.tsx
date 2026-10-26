/**
 * Affichage d'un visuel produit.
 *
 * Deux chemins selon la nature du fichier :
 *  - une photographie passe par `next/image`, donc par l'optimiseur (formats
 *    modernes, redimensionnement, `srcset`) : sur un catalogue de poêles, les
 *    visuels fournisseur arrivent souvent en 3000 px et pèsent 2 Mo ;
 *  - une illustration vectorielle est servie telle quelle. Faire passer un SVG
 *    par l'optimiseur exige `dangerouslyAllowSVG`, un réglage qu'on évite :
 *    il ouvrirait la porte à l'exécution de script dans un SVG déposé plus
 *    tard dans `public/`.
 *
 * RÈGLE D'OR : ON N'AGRANDIT JAMAIS.
 *
 * Les visuels n'arrivent pas tous en haute résolution. Une vignette de place
 * de marché fait 470 px, une photo de fabricant 3 000 px, et le cadre de la
 * fiche produit en demande 1 000. Étirer la première pour remplir le cadre la
 * rend molle — et c'est le même défaut qui faisait passer les photos de 800 px
 * du catalogue pour des images de qualité médiocre.
 *
 * Quand la résolution réelle du fichier est connue (`image.intrinsic`, mesuré
 * par `npm run media:scan`), elle devient donc la borne haute de l'affichage :
 *  - plus grande que le cadre → l'image remplit le cadre, comme avant ;
 *  - plus petite → elle s'affiche À SA TAILLE, nette, centrée sur le fond du
 *    cadre, et `next/image` ne se voit plus demander une variante qui
 *    n'existe pas.
 *
 * C'est le cadre qui porte les proportions et le fond, et l'image qui s'y
 * ajuste : le composant parent fournit donc la boîte.
 */

import Image from 'next/image';
import type { ProductImage as ProductImageData } from '@/lib/catalog.types';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  image: ProductImageData;
  locale: Locale;
  /** Taille du cadre, en pixels : la demande, pas forcément ce qui sera rendu. */
  width: number;
  height: number;
  className?: string;
  /** `true` pour le visuel principal au-dessus de la ligne de flottaison. */
  priority?: boolean;
  sizes?: string;
}

export function ProductImage({ image, locale, width, height, className, priority, sizes }: Props) {
  const alt = image.alt[locale];
  const reelle = image.intrinsic;

  // Bornes de rendu : jamais au-delà du fichier, jamais au-delà du cadre.
  const rendu = reelle
    ? { width: Math.min(width, reelle.width), height: Math.min(height, reelle.height) }
    : { width, height };

  /*
   * Le plafond CSS est ce qui empêche réellement l'étirement : les attributs
   * `width`/`height` ne décrivent que les proportions et le `srcset`, c'est la
   * feuille de style qui décide de la taille à l'écran. Sans ce `maxWidth`,
   * une classe `w-full` étirerait l'image quelle que soit sa résolution.
   */
  const plafond = reelle
    ? { maxWidth: `${reelle.width}px`, maxHeight: `${reelle.height}px` }
    : undefined;

  /*
   * `sizes` décrit la largeur que l'image OCCUPERA dans la page, et sert à
   * choisir la variante à télécharger. Il n'a de sens que si l'image peut
   * vraiment atteindre cette largeur.
   *
   * Pour un fichier déjà plus petit que son cadre, le plafond ci-dessus lui
   * interdit de grandir : annoncer « 34 rem » serait faux, et `next/image`
   * fabriquerait huit variantes jusqu'à 3840 px d'un fichier de 470 px — que
   * l'optimiseur se contenterait de renvoyer tel quel. On laisse donc tomber
   * `sizes` dans ce cas, et le `srcset` se réduit à la taille réelle.
   */
  const borne = reelle !== undefined && reelle.width <= width;
  const sizesUtile = borne ? undefined : sizes;

  if (image.placeholder) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- illustration SVG servie sans optimiseur, cf. en-tête
      <img
        src={image.src}
        alt={alt}
        width={rendu.width}
        height={rendu.height}
        className={className}
        style={plafond}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={image.src}
      alt={alt}
      width={rendu.width}
      height={rendu.height}
      className={className}
      style={plafond}
      priority={priority}
      sizes={sizesUtile}
    />
  );
}
