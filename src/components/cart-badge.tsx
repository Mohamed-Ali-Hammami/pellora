'use client';

/** Compteur d'articles de l'en-tête. Composant client minimal : seul le nombre change. */

import { useCart } from './cart-provider';

export function CartBadge() {
  const { itemCount, loading } = useCart();
  if (loading || itemCount === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-ember px-1 text-[0.6875rem] font-bold leading-none text-white"
    >
      {itemCount}
    </span>
  );
}

/** Même information, annoncée aux lecteurs d'écran. */
export function CartCountLabel({ singular, plural }: { singular: string; plural: string }) {
  const { itemCount, loading } = useCart();
  if (loading) return null;
  return (
    <span className="sr-only">
      {itemCount} {itemCount === 1 ? singular : plural}
    </span>
  );
}
