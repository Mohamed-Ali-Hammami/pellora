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
 */

import Image from 'next/image';
import type { ProductImage as ProductImageData } from '@/lib/catalog.types';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  image: ProductImageData;
  locale: Locale;
  width: number;
  height: number;
  className?: string;
  /** `true` pour le visuel principal au-dessus de la ligne de flottaison. */
  priority?: boolean;
  sizes?: string;
}

export function ProductImage({ image, locale, width, height, className, priority, sizes }: Props) {
  const alt = image.alt[locale];

  if (image.placeholder) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- illustration SVG servie sans optimiseur, cf. en-tête
      <img
        src={image.src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={image.src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes={sizes}
    />
  );
}
