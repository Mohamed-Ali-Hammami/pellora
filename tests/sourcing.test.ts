import { describe, it, expect } from 'vitest';
import {
  costOf, explodeToSupplierLines, maxLeadTimeDays, assertSourcingComplete, sourcing,
} from '@/lib/sourcing';
import { products, getProductById } from '@/lib/catalog';
import { splitVatInclusive } from '@/lib/money';

describe('approvisionnement', () => {
  it('a un coût calculable pour chaque produit du catalogue', () => {
    // Sans cela, une commande sur ce produit echouerait au traitement.
    expect(() => assertSourcingComplete()).not.toThrow();
  });

  it('additionne les composants d’un lot', () => {
    const expected =
      costOf('dripper-ceramique') +
      costOf('verseuse-600') +
      costOf('balance-precision') +
      costOf('filtre-inox');
    expect(costOf('kit-rituel')).toBe(expected);
  });

  it('aplatit les lots imbriques', () => {
    // kit-rituel-moulin contient kit-rituel, qui contient lui-meme 4 articles.
    const lines = explodeToSupplierLines('kit-rituel-moulin', 1);
    const skus = lines.map((l) => l.supplierSku).sort();
    expect(skus).toEqual(
      ['EU-DRP-C02', 'EU-CRF-600', 'EU-SCL-01T', 'EU-FLT-INX', 'EU-GRD-38C'].sort(),
    );
    // Aucune ligne ne doit referencer un lot : le fournisseur ne connait que des articles.
    for (const line of lines) {
      expect(sourcing[line.productId]).toBeDefined();
    }
  });

  it('multiplie les quantités a travers le lot', () => {
    const lines = explodeToSupplierLines('kit-rituel', 3);
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line.quantity).toBe(3);
  });

  it('refuse un produit inconnu', () => {
    expect(() => costOf('inconnu')).toThrow(/produit inconnu/);
  });

  it('retient le délai de préparation le plus long', () => {
    // Le carnet vient d’un autre fournisseur, avec 3 jours de préparation.
    expect(maxLeadTimeDays(['filtre-inox', 'carnet-degustation'])).toBe(3);
    expect(maxLeadTimeDays([])).toBe(2);
  });

  it('laisse une marge brute positive sur chaque produit', () => {
    // Un produit vendu a perte est une erreur de saisie, pas une strategie.
    for (const product of products) {
      const { net } = splitVatInclusive(product.price);
      const cost = costOf(product.id);
      expect(net, `${product.id} vendu a perte`).toBeGreaterThan(cost);
    }
  });

  it('garde une marge brute d’au moins 45 % sur chaque produit', () => {
    // En dessous, la publicite ne peut pas être financee (cf. docs/ECONOMICS.md).
    for (const product of products) {
      const { net } = splitVatInclusive(product.price);
      const margin = ((net - costOf(product.id)) / net) * 100;
      expect(margin, `${product.id} : marge de ${margin.toFixed(1)} %`).toBeGreaterThan(45);
    }
  });

  it('rend les lots moins chers que leurs composants separes', () => {
    // Un prix barre doit correspondre a une economie réelle, sinon c’est
    // une pratique commerciale trompeuse.
    for (const product of products.filter((p) => p.bundleOf.length > 0)) {
      const separately = product.bundleOf.reduce(
        (acc, id) => acc + (getProductById(id)?.price ?? 0),
        0,
      );
      expect(product.price, `${product.id}`).toBeLessThan(separately);
      if (product.compareAtPrice !== null) {
        // Le prix barre ne doit pas depasser la somme réelle des composants.
        expect(product.compareAtPrice, `${product.id} : prix barre gonfle`).toBeLessThanOrEqual(
          separately,
        );
      }
    }
  });
});
