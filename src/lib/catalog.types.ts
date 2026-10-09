import type { Cents } from './money';

export type ProductCategory = 'kit' | 'extraction' | 'mouture' | 'precision' | 'accessoire';

export interface ProductVariant {
  id: string;
  label: string;
  /** Surcout TTC par rapport au prix de base du produit. Peut être 0. */
  priceDelta: Cents;
}

export interface ProductImage {
  /** Chemin local (`/img/...`) ou URL absolue d’un domaine déclaré dans next.config.ts. */
  src: string;
  alt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  /** Prix de vente TTC. */
  price: Cents;
  /** Prix barre TTC, pour les lots. `null` si pas de référence barrée honnête. */
  compareAtPrice: Cents | null;
  /** Une phrase : le bénéfice, pas la caractéristique. */
  tagline: string;
  description: string;
  bullets: readonly string[];
  specs: readonly { label: string; value: string }[];
  images: readonly ProductImage[];
  variants: readonly ProductVariant[];
  /** Produits proposés en complément sur la fiche et au panier. */
  crossSell: readonly string[];
  /** Mis en avant en page d’accueil. */
  hero: boolean;
  /** Poids en grammes, emballage inclus — sert au calcul des frais de port. */
  weightGrams: number;
  /** Ids des produits inclus, si c’est un lot. */
  bundleOf: readonly string[];
  badge: string | null;
}

export interface CatalogEntryRef {
  productId: string;
  variantId: string | null;
}
