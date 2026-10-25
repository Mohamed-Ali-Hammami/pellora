'use client';

/**
 * État du panier, côté client.
 *
 * Le panier ne stocke QUE des identifiants et des quantités — jamais de prix.
 * Les montants affichés sont relus dans le catalogue, et les montants
 * facturés sont recalculés par le serveur. Un panier qui transporterait ses
 * prix serait modifiable depuis la console du navigateur.
 *
 * Persistance en `localStorage` : sur un panier moyen de 2 000 €, un panier
 * perdu au rechargement est une vente perdue. Les accès sont encapsulés dans
 * des try/catch, le stockage étant indisponible en navigation privée sur
 * certains navigateurs.
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
import { profileFor, resultOfAdding, MAX_QUANTITY_PER_LINE } from '@/lib/cart';
import type { Product, ProductVariant } from '@/lib/catalog.types';
import type { ShippingProfile } from '@/lib/shipping';

const STORAGE_KEY = 'pellora.cart.v1';

/**
 * Plafond par ligne, lu depuis `lib/cart` — la même valeur que celle que le
 * serveur fait respecter. Il était recopié ici, et dans deux composants :
 * quatre copies d'un même nombre, dont une seule portait le commentaire
 * « doit rester aligné ». Une valeur qu'on demande de garder alignée à la main
 * finit toujours par diverger.
 */
const MAX_QUANTITY = MAX_QUANTITY_PER_LINE;

export interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

/** Ce qu'un ajout a réellement produit. */
export interface AddOutcome {
  /** Quantité demandée. */
  requested: number;
  /** Quantité réellement ajoutée — inférieure si le plafond s'y oppose. */
  added: number;
  /** Quantité totale de cette ligne après l'ajout. */
  quantity: number;
  /** `true` si le plafond a écrêté la demande. */
  capped: boolean;
  /** Plafond par ligne, pour le message. */
  max: number;
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
  /** Contraintes de transport du panier : palette ou colis, poids total. */
  profile: ShippingProfile;
  /** `true` entre le montage et la lecture du stockage : évite un écart d'hydratation. */
  loading: boolean;
  /** Plafond par ligne. Exposé pour que les composants cessent de le recopier. */
  maxPerLine: number;
  /**
   * Ajoute au panier et DIT CE QU'IL A FAIT.
   *
   * Le plafond par ligne écrêtait en silence : demander trois exemplaires
   * quand il en reste deux en ajoutait deux, et le bouton répondait
   * « Ajouté » comme si de rien n'était. L'appelant reçoit désormais de quoi
   * l'expliquer.
   */
  add(productId: string, variantId?: string | null, quantity?: number): AddOutcome;
  /** Quantité déjà au panier pour une ligne donnée. */
  quantityOf(productId: string, variantId: string | null): number;
  remove(productId: string, variantId: string | null): void;
  setQuantity(productId: string, variantId: string | null, quantity: number): void;
  clear(): void;
}

const CartContext = createContext<CartContextValue | null>(null);

function sameLine(item: CartItem, productId: string, variantId: string | null): boolean {
  return item.productId === productId && item.variantId === variantId;
}

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtrage défensif : le catalogue a pu changer depuis la dernière visite,
    // et un panier référençant un produit retiré ferait échouer le paiement.
    return parsed.flatMap((entry): CartItem[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const record = entry as Record<string, unknown>;
      const productId = record['productId'];
      if (typeof productId !== 'string') return [];
      const product = getProductById(productId);
      if (!product) return [];

      const variantId = typeof record['variantId'] === 'string' ? record['variantId'] : null;
      // Une variante disparue du catalogue invalide la ligne : sans cela, le
      // serveur refuserait le panier au moment du paiement.
      if (variantId !== null && !product.variants.some((v) => v.id === variantId)) return [];
      if (variantId === null && product.variants.length > 0) return [];

      const quantity = typeof record['quantity'] === 'number' ? record['quantity'] : 1;
      return [
        {
          productId,
          variantId,
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
  // `localStorage`, lire pendant le rendu provoquerait un écart d'hydratation.
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

  const add = useCallback(
    (productId: string, variantId: string | null = null, quantity = 1): AddOutcome => {
      const vide: AddOutcome = {
        requested: quantity,
        added: 0,
        quantity: 0,
        capped: false,
        max: MAX_QUANTITY,
      };

      const product = getProductById(productId);
      if (!product) return vide;

      // Un produit à variantes exige un choix : sans cela, le prix affiché et
      // le prix facturé pourraient différer.
      const resolvedVariant =
        variantId ?? (product.variants.length > 0 ? (product.variants[0]?.id ?? null) : null);

      // Le résultat est calculé AVANT la mise à jour, sur l'état courant : il
      // doit être rendu à l'appelant de façon synchrone, pour qu'il puisse
      // l'afficher dans la foulée du clic.
      const existing = items.find((item) => sameLine(item, productId, resolvedVariant));
      const résultat = resultOfAdding(existing?.quantity ?? 0, quantity);

      setItems((previous) => {
        const présent = previous.find((item) => sameLine(item, productId, resolvedVariant));
        if (présent) {
          return previous.map((item) =>
            sameLine(item, productId, resolvedVariant)
              ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + quantity) }
              : item,
          );
        }
        return [
          ...previous,
          { productId, variantId: resolvedVariant, quantity: Math.min(MAX_QUANTITY, quantity) },
        ];
      });

      return résultat;
    },
    [items],
  );

  const remove = useCallback((productId: string, variantId: string | null) => {
    setItems((previous) => previous.filter((item) => !sameLine(item, productId, variantId)));
  }, []);

  const setQuantity = useCallback(
    (productId: string, variantId: string | null, quantity: number) => {
      if (quantity <= 0) {
        setItems((previous) => previous.filter((item) => !sameLine(item, productId, variantId)));
        return;
      }
      setItems((previous) =>
        previous.map((item) =>
          sameLine(item, productId, variantId)
            ? { ...item, quantity: Math.min(MAX_QUANTITY, quantity) }
            : item,
        ),
      );
    },
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  /** Quantité déjà au panier pour cette ligne. 0 si elle n'y est pas. */
  const quantityOf = useCallback(
    (productId: string, variantId: string | null) =>
      items.find((item) => sameLine(item, productId, variantId))?.quantity ?? 0,
    [items],
  );

  const value = useMemo<CartContextValue>(() => {
    const resolved = items.flatMap((item): ResolvedItem[] => {
      const product = getProductById(item.productId);
      if (!product) return [];
      const variant = product.variants.find((v) => v.id === item.variantId) ?? null;
      const unit = unitPrice(product, variant?.id ?? null);
      return [{ ...item, product, variant, unitPrice: unit, lineTotal: unit * item.quantity }];
    });

    return {
      items,
      resolved,
      itemCount: resolved.reduce((acc, item) => acc + item.quantity, 0),
      subtotal: resolved.reduce((acc, item) => acc + item.lineTotal, 0),
      profile: profileFor(resolved),
      loading,
      maxPerLine: MAX_QUANTITY,
      add,
      quantityOf,
      remove,
      setQuantity,
      clear,
    };
  }, [items, loading, add, quantityOf, remove, setQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l’intérieur de <CartProvider>');
  }
  return context;
}
