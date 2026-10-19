'use client';

/**
 * Vide le panier à l'arrivée sur la page de confirmation.
 *
 * Composant distinct et non un effet dans la page : la page de confirmation
 * reste ainsi un composant serveur, et seule cette poignée de lignes part
 * dans le navigateur.
 */

import { useEffect } from 'react';
import { useCart } from '@/components/cart-provider';

export function ClearCart() {
  const { clear, loading } = useCart();

  useEffect(() => {
    // On attend la lecture du stockage : vider avant que le panier soit lu
    // réécrirait l'ancien contenu juste après.
    if (!loading) clear();
  }, [clear, loading]);

  return null;
}
