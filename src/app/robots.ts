import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand';

/**
 * L’indexation est fermée par défaut.
 *
 * Mettre en ligne une boutique dont les mentions légales portent encore des
 * champs à compléter et dont les visuels sont des placeholders exposé à une
 * mauvaise première impression durable cote referencement. Basculez
 * NEXT_PUBLIC_ALLOW_INDEXING à « true » le jour du lancement réel.
 */
export default function robots(): MetadataRoute.Robots {
  const allowed = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

  return {
    rules: allowed
      ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/panier', '/commande/'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: `${brand.url}/sitemap.xml`,
  };
}
