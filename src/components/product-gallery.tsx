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
      <div className="relative overflow-hidden rounded-xl border border-line bg-sand">
        <ProductImage
          image={active}
          locale={locale}
          width={1000}
          height={1250}
          priority
          sizes="(min-width: 1024px) 34rem, 92vw"
          className="aspect-4/5 w-full object-contain p-8"
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
              <ProductImage
                image={image}
                locale={locale}
                width={160}
                height={160}
                className="h-20 w-20 object-contain p-2"
              />
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
