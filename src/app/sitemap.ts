import type { MetadataRoute } from 'next';
import { products } from '@/lib/catalog';
import { guides } from '@/lib/guides';
import { brand } from '@/lib/brand';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: brand.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${brand.url}/produits`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...products.map((product) => ({
      url: `${brand.url}/produits/${product.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...guides.map((guide) => ({
      url: `${brand.url}/guides/${guide.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: `${brand.url}/le-rituel`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${brand.url}/livraison`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${brand.url}/retours`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${brand.url}/cgv`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${brand.url}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${brand.url}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
