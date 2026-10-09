'use client';

/**
 * État du panier, cote client.
 *
 * Le panier ne stocke QUE des identifiants et des quantités — jamais de prix.
 * Les montants affiches sont relus dans le catalogue, et les montants factures
 * sont recalcules par le serveur. Un panier qui transporterait ses prix serait
 * modifiable depuis la console du navigateur.
 *
 * Persistance en `localStorage` : un panier perdu au rechargement de la page
 * est une vente perdue. Les accès sont encapsulés dans des try/catch car le
 * stockage est indisponible en navigation privée sur certains navigateurs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getProductById, unitPrice } from '@/lib/catalog';
import { amountToFreeShipping } from '@/lib/shipping';
import type { Product, ProductVariant } from '@/lib/catalog.types';

const STORAGE_KEY = 'verseuse.cart.v1';
const MAX_QUANTITY = 10;

export interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface ResolvedItem extends CartItem {
  product: Product;
  variant: ProductVariant | null;
  unitPrice: number;
  lineTotal: number;
}

interface CartContextValue {
  items: CartItem[];
  resolved: ResolvedItem[];
  itemCount: number;
  subtotal: number;
  toFreeShipping: number;
  /** `true` entre le montage et la lecture du stockage : évite un écart d’hydratation. */
  loading: boolean;
  add(productId: string, variantId?: string | null, quantity?: number): void;
  remove(productId: string, variantId: string | null): void;
  setQuantity(productId: string, variantId: string | null, quantity: number): void;
  clear(): void;
}

const CartContext = createContext<CartContextValue | null>(null);

function sameLine(a: CartItem, productId: string, variantId: string | null): boolean {
  return a.productId === productId && a.variantId === variantId;
}

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtrage défensif : le catalogue a pu changer depuis la dernière visite,
    // et un panier référençant un produit retire ferait échouer le paiement.
    return parsed.flatMap((entry): CartItem[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const e = entry as Record<string, unknown>;
      if (typeof e['productId'] !== 'string') return [];
      if (!getProductById(e['productId'])) return [];
      const quantity = typeof e['quantity'] === 'number' ? e['quantity'] : 1;
      return [
        {
          productId: e['productId'],
          variantId: typeof e['variantId'] === 'string' ? e['variantId'] : null,
          quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity))),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Lecture après montage uniquement : le serveur ne connaît pas
  // `localStorage`, lire pendant le rendu provoquerait un écart d’hydratation.
  useEffect(() => {
    setItems(readStorage());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Stockage plein ou bloqué : le panier reste valide pour cette session.
    }
  }, [items, loading]);

  const add = useCallback((productId: string, variantId: string | null = null, quantity = 1) => {
    const product = getProductById(productId);
    if (!product) return;
    // Un produit a variantes exige un choix : sans cela le prix affiche et le
    // prix facture pourraient différer.
    const resolvedVariant =
      variantId ?? (product.variants.length > 0 ? product.variants[0]!.id : null);

    setItems((previous) => {
      const existing = previous.find((i) => sameLine(i, productId, resolvedVariant));
      if (existing) {
        return previous.map((i) =>
          sameLine(i, productId, resolvedVariant)
            ? { ...i, quantity: Math.min(MAX_QUANTITY, i.quantity + quantity) }
            : i,
        );
      }
      return [...previous, { productId, variantId: resolvedVariant, quantity }];
    });
  }, []);

  const remove = useCallback((productId: string, variantId: string | null) => {
    setItems((previous) => previous.filter((i) => !sameLine(i, productId, variantId)));
  }, []);

  const setQuantity = useCallback((productId: string, variantId: string | null, quantity: number) => {
    if (quantity <= 0) {
      setItems((previous) => previous.filter((i) => !sameLine(i, productId, variantId)));
      return;
    }
    setItems((previous) =>
      previous.map((i) =>
        sameLine(i, productId, variantId)
          ? { ...i, quantity: Math.min(MAX_QUANTITY, quantity) }
          : i,
      ),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const resolved = items.flatMap((item): ResolvedItem[] => {
      const product = getProductById(item.productId);
      if (!product) return [];
      const variant = product.variants.find((v) => v.id === item.variantId) ?? null;
      const unit = unitPrice(product, variant?.id ?? null);
      return [{ ...item, product, variant, unitPrice: unit, lineTotal: unit * item.quantity }];
    });

    const subtotal = resolved.reduce((acc, i) => acc + i.lineTotal, 0);

    return {
      items,
      resolved,
      itemCount: resolved.reduce((acc, i) => acc + i.quantity, 0),
      subtotal,
      toFreeShipping: amountToFreeShipping(subtotal),
      loading,
      add,
      remove,
      setQuantity,
      clear,
    };
  }, [items, loading, add, remove, setQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilise a l’intérieur de <CartProvider>');
  }
  return context;
}
