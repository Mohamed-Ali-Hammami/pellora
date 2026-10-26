/**
 * Les sections de la boutique, dans l'ordre d'affichage.
 *
 * Source unique : l'en-tête, le pied de page, la page boutique et le fil
 * d'Ariane la lisent. Ajouter une famille se fait en quatre endroits, et
 * TypeScript refuse de compiler tant qu'il en manque un : `productCategories`
 * dans `catalog.types.ts`, la route dans `routes.ts`, les trois clés dans
 * chacun des quatre dictionnaires, et un dossier sous
 * `src/app/[locale]/shop/` qui appelle `categoryPage`.
 */

import { productCategories, type ProductCategory } from '@/lib/catalog.types';
import { href, type RouteName } from './routes';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';

/** Le nom de route et celui de la famille coïncident : une section, une page. */
export const categoryRoutes = productCategories satisfies readonly RouteName[];

export interface CategoryLink {
  category: ProductCategory;
  href: string;
  label: string;
  short: string;
  tagline: string;
}

export function categoryLinks(locale: Locale, dict: Dictionary): readonly CategoryLink[] {
  return productCategories.map((category) => ({
    category,
    href: href(category, locale),
    label: dict.categories[category],
    short: dict.categories[`${category}Short` as const],
    tagline: dict.categories[`${category}Tagline` as const],
  }));
}

/**
 * Sous-ensemble affiché dans la barre du haut. Dix entrées n'y tiennent pas
 * à côté du logo, du sélecteur de langue et du panier ; les sept autres
 * restent à un clic, par « tout le chauffage » et par le menu mobile, qui lui
 * les porte toutes.
 */
export const headlineCategories = ['pellet', 'wood', 'insert'] as const satisfies readonly ProductCategory[];
