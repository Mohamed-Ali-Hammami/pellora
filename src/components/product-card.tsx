import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, savingsPercent } from '@/lib/money';
import type { Product } from '@/lib/catalog.types';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = product.images[0];
  const savings = product.compareAtPrice ? savingsPercent(product.compareAtPrice, product.price) : 0;

  return (
    <Link href={`/produits/${product.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-card border border-line bg-sand">
        {image && (
          <Image
            src={image.src}
            alt={image.alt}
            width={800}
            height={800}
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
            {product.badge}
          </span>
        )}
        {savings > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">
            -{savings} %
          </span>
        )}
      </div>

      <div className="mt-3">
        <h3 className="font-display text-base font-semibold transition-colors group-hover:text-accent">
          {product.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted">{product.tagline}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-semibold">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-muted line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
