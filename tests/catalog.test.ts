import { describe, it, expect } from 'vitest';
import { products, categoryLabels, getProductBySlug, getProductById, unitPrice, getHeroProducts } from '@/lib/catalog';
import { guides, getGuide } from '@/lib/guides';

describe('integrite du catalogue', () => {
  it('donne un intitule a chaque categorie utilisee', () => {
    // Un `Record<string, string>` accepte n'importe quelle cle : TypeScript ne
    // signale pas une cle mal orthographiee, et la section s'afficherait alors
    // sans titre. Ce test est le seul filet.
    for (const product of products) {
      expect(categoryLabels[product.category], `categorie « ${product.category} »`).toBeTruthy();
    }
  });

  it('n’a ni identifiant ni slug en double', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
  });

  it('n’a que des slugs valides pour une URL', () => {
    for (const product of products) {
      expect(product.slug, product.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('ne reference que des produits existants', () => {
    for (const product of products) {
      for (const id of [...product.crossSell, ...product.bundleOf]) {
        expect(getProductById(id), `${product.id} -> ${id}`).toBeDefined();
      }
      // Un lot ne doit pas se contenir lui-meme : `costOf` boucleraient sans fin.
      expect(product.bundleOf).not.toContain(product.id);
    }
  });

  it('retrouve chaque produit par son slug', () => {
    for (const product of products) {
      expect(getProductBySlug(product.slug)?.id).toBe(product.id);
    }
  });

  it('a des prix strictement positifs et entiers', () => {
    for (const product of products) {
      expect(Number.isInteger(product.price), product.id).toBe(true);
      expect(product.price, product.id).toBeGreaterThan(0);
      if (product.compareAtPrice !== null) {
        expect(product.compareAtPrice, product.id).toBeGreaterThan(product.price);
      }
    }
  });

  it('a des identifiants de variante uniques et un prix calculable', () => {
    for (const product of products) {
      const ids = product.variants.map((v) => v.id);
      expect(new Set(ids).size, product.id).toBe(ids.length);
      for (const variant of product.variants) {
        expect(unitPrice(product, variant.id)).toBe(product.price + variant.priceDelta);
      }
    }
  });

  it('donne a chaque produit un visuel avec texte alternatif', () => {
    for (const product of products) {
      expect(product.images.length, product.id).toBeGreaterThan(0);
      for (const image of product.images) {
        expect(image.alt.length, `${product.id} : alt vide`).toBeGreaterThan(8);
        expect(image.src).toMatch(/^\/img\/|^https:\/\//);
      }
    }
  });

  it('met en avant au moins un produit en page d’accueil', () => {
    expect(getHeroProducts().length).toBeGreaterThan(0);
  });

  it('a un poids renseigne pour le calcul des frais de port', () => {
    for (const product of products) {
      expect(product.weightGrams, product.id).toBeGreaterThan(0);
    }
  });
});

describe('integrite des guides', () => {
  it('n’a pas de slug en double et les retrouve tous', () => {
    expect(new Set(guides.map((g) => g.slug)).size).toBe(guides.length);
    for (const guide of guides) {
      expect(getGuide(guide.slug)?.title).toBe(guide.title);
      expect(guide.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('ne renvoie que vers des produits existants', () => {
    for (const guide of guides) {
      for (const id of guide.relatedProducts) {
        expect(getProductById(id), `${guide.slug} -> ${id}`).toBeDefined();
      }
    }
  });

  it('a des sections non vides', () => {
    for (const guide of guides) {
      expect(guide.sections.length).toBeGreaterThan(1);
      for (const section of guide.sections) {
        expect(section.heading.length).toBeGreaterThan(3);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });
});
