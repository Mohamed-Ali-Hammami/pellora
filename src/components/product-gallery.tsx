'use client';

/** Galerie de la fiche produit : visuel principal et vignettes. */

import { useState } from 'react';
import { ProductImage } from './product-image';
import type { ProductImage as ProductImageData } from '@/lib/catalog.types';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  images: readonly ProductImageData[];
  locale: Locale;
  /** Mention affichée tant que le produit n'a que des illustrations. */
  placeholderNotice: string;
}

export function ProductGallery({ images, locale, placeholderNotice }: Props) {
  const [index, setIndex] = useState(0);
  const active = images[index] ?? images[0];
  if (!active) return null;

  return (
    <div>
      {/*
        * Le CADRE porte les proportions, le fond et la marge ; l'image s'y
        * centre. Auparavant les proportions étaient sur l'image elle-même, ce
        * qui l'obligeait à remplir le cadre quelle que soit sa résolution — et
        * rendait impossible de ne pas l'agrandir. Un visuel de 470 px
        * s'affiche maintenant net, à sa taille, au milieu du cadre.
        */}
      <div className="relative flex aspect-4/5 items-center justify-center overflow-hidden rounded-xl border border-line bg-sand p-8">
        <ProductImage
          image={active}
          locale={locale}
          width={1000}
          height={1250}
          priority
          sizes="(min-width: 1024px) 34rem, 92vw"
          className="max-h-full w-auto max-w-full object-contain"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2.5">
          {images.map((image, position) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={image.alt[locale]}
              aria-current={position === index ? 'true' : undefined}
              className={`overflow-hidden rounded-lg border bg-sand transition-colors ${
                position === index ? 'border-ink' : 'border-line hover:border-ink-soft'
              }`}
            >
              <span className="flex h-20 w-20 items-center justify-center p-2">
                <ProductImage
                  image={image}
                  locale={locale}
                  width={160}
                  height={160}
                  className="max-h-full w-auto max-w-full object-contain"
                />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {active.placeholder ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">{placeholderNotice}</p>
      ) : null}
    </div>
  );
}
