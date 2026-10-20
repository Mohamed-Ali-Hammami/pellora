import type { Cents } from './money';
import type { Localized } from './i18n/config';

/**
 * Familles de produits.
 *
 * Deux familles de poêles, qui ne répondent pas au même besoin :
 *  - `air`   : poêle à air ventilé — chauffe la ou les pièces où l'air est
 *              soufflé, éventuellement canalisé vers des pièces voisines ;
 *  - `hydro` : poêle hydro — raccordé au circuit de chauffage central
 *              (radiateurs, plancher chauffant) et parfois à l'eau chaude
 *              sanitaire. Il remplace ou seconde une chaudière.
 * `accessoire` regroupe ce qui se vend avec : conduit, thermostat, entretien.
 */
export type ProductCategory = 'air' | 'hydro' | 'accessoire';

export const productCategories = ['air', 'hydro', 'accessoire'] as const;

export interface ProductVariant {
  id: string;
  label: Localized<string>;
  /** Surcoût TTC par rapport au prix de base. Peut être 0. */
  priceDelta: Cents;
}

export interface ProductImage {
  /** Chemin local (`/img/...`) ou URL absolue d'un domaine déclaré dans next.config.ts. */
  src: string;
  alt: Localized<string>;
  /**
   * `true` pour un rendu de substitution (illustration vectorielle) et non une
   * photographie du produit réel. Sert à afficher la mention correspondante :
   * présenter un dessin comme une photo de produit serait une pratique
   * commerciale trompeuse.
   */
  placeholder: boolean;
}

export interface SpecRow {
  label: Localized<string>;
  value: Localized<string>;
}

/**
 * Caractéristiques techniques exploitées par le code (filtres, calculateur de
 * puissance, données structurées). Elles sont séparées du tableau `specs`
 * affiché, qui peut contenir n'importe quelle ligne libre.
 *
 * ATTENTION : ces valeurs ont une portée réglementaire. La puissance, le
 * rendement et la classe énergétique doivent reprendre À L'IDENTIQUE la fiche
 * technique et l'étiquette énergétique du fabricant (règlement UE 2015/1185
 * pour l'écoconception, 2015/1186 pour l'étiquetage). Les annoncer à
 * l'estime engage la responsabilité du vendeur.
 */
export interface StoveTech {
  /**
   * Puissance maximale, en kW. SEUL champ technique obligatoire : le filtre
   * de la boutique et le calculateur de puissance s'appuient dessus.
   */
  powerMaxKw: number;
  /** Puissance minimale de modulation, en kW. `null` tant qu'elle n'est pas connue. */
  powerMinKw: number | null;
  /**
   * Surface chauffée annoncée, en m². `heatedAreaMinM2` vaut `null` quand le
   * fabricant ne donne qu'un maximum (« jusqu'à 90 m² »).
   */
  heatedAreaMinM2: number | null;
  heatedAreaMaxM2: number;
  /** Capacité du réservoir à granulés, en kg. */
  hopperKg: number | null;
  /** Rendement à puissance nominale, en %. */
  efficiencyPercent: number | null;
  /** Classe de l'étiquette énergétique (règlement UE 2015/1186). */
  energyClass: string;
  /** Diamètre de sortie des fumées, en mm. */
  flueDiameterMm: number | null;
  /** Niveau sonore annoncé en fonctionnement, en dB(A). */
  noiseDbA: number | null;
  /** Puissance cédée à l'eau, en kW — poêles hydro uniquement. */
  waterPowerKw: number | null;
  /** Production d'eau chaude sanitaire — poêles hydro uniquement. */
  domesticHotWater: boolean;
  /** Nombre de sorties canalisables — poêles à air uniquement. */
  ductedOutlets: number | null;
  dimensionsMm: { height: number; width: number; depth: number } | null;
  weightKg: number | null;
}

export interface Product {
  id: string;
  /** Slug localisé : l'URL espagnole ne doit pas être un mot français. */
  slug: Localized<string>;
  /** Nom commercial — identique dans les quatre langues (c'est une référence). */
  name: string;
  category: ProductCategory;
  /** Prix de vente TTC. */
  price: Cents;
  /** Prix barré TTC. `null` s'il n'existe pas de référence barrée honnête. */
  compareAtPrice: Cents | null;
  /** Une phrase : le bénéfice, pas la caractéristique. */
  tagline: Localized<string>;
  description: Localized<string>;
  bullets: Localized<readonly string[]>;
  specs: readonly SpecRow[];
  tech: StoveTech | null;
  images: readonly ProductImage[];
  variants: readonly ProductVariant[];
  /** Produits proposés en complément sur la fiche et au panier. */
  crossSell: readonly string[];
  /** Mis en avant en page d'accueil. */
  hero: boolean;
  /**
   * `true` quand les caractéristiques proviennent de la documentation réelle
   * du fabricant, `false` tant que ce sont des valeurs de démonstration.
   *
   * Sert à afficher l'avertissement au bon endroit : une fiche vérifiée ne
   * doit pas porter la mention qui dit le contraire, et une fiche qui ne l'est
   * pas doit la porter même si le reste du catalogue est passé en réel.
   */
  dataVerified: boolean;
  /** Poids expédié en grammes, emballage inclus — sert au calcul du port. */
  weightGrams: number;
  /** `true` si l'article part en messagerie palettisée et non en colis. */
  freight: boolean;
  badge: Localized<string> | null;
  /** Délai d'expédition annoncé par le fournisseur, en jours ouvrés. */
  dispatchDaysMin: number;
  dispatchDaysMax: number;
}

export interface CatalogEntryRef {
  productId: string;
  variantId: string | null;
}
