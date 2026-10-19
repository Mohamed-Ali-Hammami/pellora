import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand';

/**
 * Indexation fermée par défaut.
 *
 * Tant que le catalogue contient des données de démonstration et que les
 * mentions légales sont incomplètes, le site ne doit pas apparaître dans les
 * résultats de recherche : une fiche technique fictive indexée est à la fois
 * un risque juridique et un mauvais départ en référencement, les premières
 * pages vues faisant la réputation du domaine.
 *
 * Passez NEXT_PUBLIC_ALLOW_INDEXING à « true » le jour du lancement.
 */
export default function robots(): MetadataRoute.Robots {
  const allowed = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

  if (!allowed) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Pages personnelles ou sans contenu indexable.
        disallow: ['/api/', '/*/cart', '/*/panier', '/*/winkelwagen', '/*/carrito', '/*/checkout/', '/*/commande/', '/*/bestelling/', '/*/pedido/'],
      },
    ],
    sitemap: `${brand.url}/sitemap.xml`,
    host: brand.url,
  };
}
