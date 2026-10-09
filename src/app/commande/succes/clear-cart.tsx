'use client';

import { useEffect } from 'react';
import { useCart } from '@/components/cart-provider';

/**
 * Vide le panier à l’arrivée sur la page de confirmation.
 *
 * C’est ici et nulle part ailleurs : si on vidait le panier au moment du
 * départ vers Stripe, un client qui abandonne la page de paiement reviendrait
 * sur un panier vide et serait perdu pour de bon.
 */
export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
