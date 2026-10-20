import { describe, it, expect } from 'vitest';
import {
  products,
  getProductBySlug,
  getProductById,
  unitPrice,
  getHeroProducts,
  getStoves,
  getProductsByCategory,
} from '@/lib/catalog';
import { isAppliance, productCategories } from '@/lib/catalog.types';
import { guides, getGuideBySlug } from '@/lib/guides';
import { hasOnlyPlaceholders } from '@/lib/product-media';
import { locales } from '@/lib/i18n/config';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('intégrité du catalogue', () => {
  it('n’a pas d’identifiant en double', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it('n’a pas de slug en double, dans aucune langue', () => {
    // Deux produits partageant un slug dans une seule langue rendraient l'une
    // des deux fiches inatteignable — sans aucune erreur visible ailleurs.
    for (const locale of locales) {
      const slugs = products.map((p) => p.slug[locale]);
      expect(new Set(slugs).size, `collision de slug en ${locale}`).toBe(products.length);
    }
  });

  it('n’a que des slugs valides pour une URL, dans les quatre langues', () => {
    for (const product of products) {
      for (const locale of locales) {
        expect(product.slug[locale], `${product.id} / ${locale}`).toMatch(SLUG);
      }
    }
  });

  it('retrouve chaque produit par son slug, dans sa langue', () => {
    for (const product of products) {
      for (const locale of locales) {
        expect(getProductBySlug(product.slug[locale], locale)?.id).toBe(product.id);
      }
    }
  });

  it('ne reconnaît pas un slug hors de sa langue', () => {
    // Garantit l'absence de contenu dupliqué : l'URL française ne doit pas
    // répondre sous le préfixe espagnol.
    const product = products[0];
    expect(product).toBeDefined();
    if (!product || product.slug.fr === product.slug.es) return;
    expect(getProductBySlug(product.slug.fr, 'es')).toBeUndefined();
  });

  it('ne référence que des produits existants en vente croisée', () => {
    for (const product of products) {
      for (const id of product.crossSell) {
        expect(getProductById(id), `${product.id} -> ${id}`).toBeDefined();
      }
      expect(product.crossSell, product.id).not.toContain(product.id);
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
        for (const locale of locales) {
          expect(variant.label[locale].length, `${product.id}/${variant.id}/${locale}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('traduit tous les textes visibles de chaque fiche', () => {
    for (const product of products) {
      for (const locale of locales) {
        expect(product.tagline[locale].length, `${product.id} tagline ${locale}`).toBeGreaterThan(10);
        expect(product.description[locale].length, `${product.id} description ${locale}`).toBeGreaterThan(80);
        expect(product.bullets[locale].length, `${product.id} bullets ${locale}`).toBeGreaterThan(2);
        for (const spec of product.specs) {
          expect(spec.label[locale].length, `${product.id} spec label ${locale}`).toBeGreaterThan(0);
          expect(spec.value[locale].length, `${product.id} spec value ${locale}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('donne à chaque produit un visuel avec texte alternatif traduit', () => {
    for (const product of products) {
      expect(product.images.length, product.id).toBeGreaterThan(0);
      for (const image of product.images) {
        expect(image.src).toMatch(/^\/img\/|^https:\/\//);
        for (const locale of locales) {
          expect(image.alt[locale].length, `${product.id} alt ${locale}`).toBeGreaterThan(8);
        }
      }
    }
  });

  it('met en avant au moins un produit en page d’accueil', () => {
    expect(getHeroProducts().length).toBeGreaterThan(0);
  });

  it('a un poids et un délai d’expédition renseignés', () => {
    for (const product of products) {
      expect(product.weightGrams, product.id).toBeGreaterThan(0);
      expect(product.dispatchDaysMin, product.id).toBeGreaterThan(0);
      expect(product.dispatchDaysMax, product.id).toBeGreaterThanOrEqual(product.dispatchDaysMin);
    }
  });

  it('range chaque produit dans une famille déclarée', () => {
    for (const product of products) {
      expect(productCategories, product.id).toContain(product.category);
    }
  });

  it('présente les deux modes de diffusion chez les poêles à granulés', () => {
    // Seule famille garnie pour l'instant : c'est là que le choix air / hydro
    // se pose, et la page la présente en deux groupes.
    const granules = getProductsByCategory('pellet');
    expect(granules.some((p) => p.distribution === 'air')).toBe(true);
    expect(granules.some((p) => p.distribution === 'hydro')).toBe(true);
  });

  it('ne prête un mode de diffusion qu’à un appareil', () => {
    for (const product of products) {
      if (!isAppliance(product.category)) {
        // Un conduit ne diffuse rien, un sac de granulés non plus.
        expect(product.distribution, product.id).toBeNull();
      }
    }
  });

  it('expédie en messagerie palettisée tout appareil de plus de 50 kg', () => {
    // Un poêle expédié en colis serait refusé par le transporteur, après
    // encaissement : c'est un litige garanti.
    for (const product of products) {
      if (product.weightGrams > 50_000) {
        expect(product.freight, `${product.id} (${product.weightGrams} g)`).toBe(true);
      }
    }
  });
});

describe('cohérence technique des poêles', () => {
  it('renseigne un bloc technique pour chaque appareil, et aucun pour le reste', () => {
    for (const product of products) {
      if (!isAppliance(product.category)) {
        expect(product.tech, product.id).toBeNull();
      } else {
        expect(product.tech, product.id).not.toBeNull();
      }
    }
  });

  it('a des plages de puissance et de surface croissantes quand les deux bornes sont connues', () => {
    /*
     * Les bornes basses peuvent manquer : un fabricant annonce parfois
     * « jusqu'à 90 m² » sans donner de minimum. Le modèle le représente par
     * `null` plutôt que par un nombre inventé, et ce test ne contrôle donc
     * l'ordre que lorsque les deux valeurs existent.
     */
    for (const product of getStoves()) {
      const tech = product.tech;
      expect(tech).not.toBeNull();
      if (!tech) continue;

      expect(tech.powerMaxKw, product.id).toBeGreaterThan(0);
      expect(tech.heatedAreaMaxM2, product.id).toBeGreaterThan(0);

      if (tech.powerMinKw !== null) {
        expect(tech.powerMaxKw, product.id).toBeGreaterThan(tech.powerMinKw);
      }
      if (tech.heatedAreaMinM2 !== null) {
        expect(tech.heatedAreaMaxM2, product.id).toBeGreaterThan(tech.heatedAreaMinM2);
      }
      if (tech.efficiencyPercent !== null) {
        expect(tech.efficiencyPercent, product.id).toBeGreaterThan(70);
        expect(tech.efficiencyPercent, product.id).toBeLessThan(100);
      }
    }
  });

  it('ne déclare vérifiée qu’une fiche qui a de vraies photos', () => {
    /*
     * Garde-fou contre l'incohérence la plus facile à commettre en
     * remplaçant le catalogue produit par produit : annoncer des
     * caractéristiques réelles sous une illustration de substitution.
     */
    for (const product of products) {
      if (!product.dataVerified) continue;
      expect(
        hasOnlyPlaceholders(product),
        `${product.id} : données déclarées vérifiées mais visuels encore illustrés`,
      ).toBe(false);
    }
  });

  it('ne cède à l’eau qu’une part de la puissance totale, et seulement en hydro', () => {
    for (const product of products) {
      const tech = product.tech;
      if (!tech) continue;
      if (product.distribution === 'hydro') {
        expect(tech.waterPowerKw, product.id).not.toBeNull();
        expect(tech.waterPowerKw ?? 0, product.id).toBeLessThan(tech.powerMaxKw);
      } else {
        expect(tech.waterPowerKw, product.id).toBeNull();
      }
    }
  });

  it('trie les poêles par puissance maximale croissante', () => {
    const powers = getStoves().map((p) => p.tech?.powerMaxKw ?? 0);
    expect(powers).toEqual([...powers].sort((a, b) => a - b));
  });
});

describe('intégrité des guides', () => {
  it('n’a pas de slug en double et les retrouve tous, par langue', () => {
    for (const locale of locales) {
      expect(new Set(guides.map((g) => g.slug[locale])).size).toBe(guides.length);
      for (const guide of guides) {
        expect(getGuideBySlug(guide.slug[locale], locale)?.id).toBe(guide.id);
        expect(guide.slug[locale]).toMatch(SLUG);
      }
    }
  });

  it('ne renvoie que vers des produits existants', () => {
    for (const guide of guides) {
      for (const id of guide.relatedProducts) {
        expect(getProductById(id), `${guide.id} -> ${id}`).toBeDefined();
      }
    }
  });

  it('a des sections traduites et non vides', () => {
    for (const guide of guides) {
      expect(guide.sections.length, guide.id).toBeGreaterThan(1);
      for (const locale of locales) {
        expect(guide.title[locale].length, `${guide.id} titre ${locale}`).toBeGreaterThan(10);
        expect(guide.intro[locale].length, `${guide.id} intro ${locale}`).toBeGreaterThan(40);
        for (const section of guide.sections) {
          expect(section.heading[locale].length, `${guide.id} / ${locale}`).toBeGreaterThan(3);
          expect(section.paragraphs[locale].length, `${guide.id} / ${locale}`).toBeGreaterThan(0);
          if (section.list) {
            expect(section.list[locale].length, `${guide.id} liste ${locale}`).toBeGreaterThan(1);
          }
        }
      }
    }
  });

  it('a une date de mise à jour exploitable', () => {
    for (const guide of guides) {
      expect(Number.isNaN(new Date(guide.updated).getTime()), guide.id).toBe(false);
    }
  });
});
