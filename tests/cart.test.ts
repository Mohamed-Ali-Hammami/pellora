import { describe, it, expect } from 'vitest';
import { priceCart, cartInputSchema, CartError, MAX_QUANTITY_PER_LINE } from '@/lib/cart';
import { getProductById } from '@/lib/catalog';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

describe('panier — chiffrage cote serveur', () => {
  it('ignore tout prix envoye par le client', () => {
    // Scénario d’attaque : le client poste un prix de 1 centime.
    const forged = {
      lines: [{ productId: 'kit-rituel', variantId: null, quantity: 1, unitPrice: 1, price: 1 }],
      shippingCountry: 'FR',
    };
    const parsed = cartInputSchema.parse(forged);
    // Les champs de prix sont retires par le schema.
    expect(parsed.lines[0]).not.toHaveProperty('unitPrice');

    const cart = priceCart(parsed);
    // Le prix facture est celui du catalogue, pas celui envoye.
    expect(cart.subtotal).toBe(getProductById('kit-rituel')!.price);
    expect(cart.subtotal).toBe(8900);
  });

  it('refuse un produit inconnu', () => {
    expect(() =>
      priceCart({ lines: [{ productId: 'n-existe-pas', variantId: null, quantity: 1 }], shippingCountry: 'FR' }),
    ).toThrowError(CartError);
  });

  it('exige une variante quand le produit en a', () => {
    // Sans ce garde-fou, le prix affiche et le prix facture pourraient differer.
    expect(() =>
      priceCart({ lines: [{ productId: 'moulin-precision', variantId: null, quantity: 1 }], shippingCountry: 'FR' }),
    ).toThrowError(/variante requise/);
  });

  it('refuse une variante inexistante', () => {
    expect(() =>
      priceCart({ lines: [{ productId: 'moulin-precision', variantId: 'dore', quantity: 1 }], shippingCountry: 'FR' }),
    ).toThrowError(/variante inconnue/);
  });

  it('applique le surcout de variante', () => {
    const base = priceCart({
      lines: [{ productId: 'moulin-precision', variantId: 'noir', quantity: 1 }],
      shippingCountry: 'FR',
    });
    const upgraded = priceCart({
      lines: [{ productId: 'moulin-precision', variantId: 'inox', quantity: 1 }],
      shippingCountry: 'FR',
    });
    expect(upgraded.subtotal - base.subtotal).toBe(600);
  });

  it('fusionne les lignes en doublon', () => {
    const cart = priceCart({
      lines: [
        { productId: 'filtre-inox', variantId: null, quantity: 2 },
        { productId: 'filtre-inox', variantId: null, quantity: 3 },
      ],
      shippingCountry: 'FR',
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(5);
  });

  it('plafonne la quantité par ligne', () => {
    const cart = priceCart({
      lines: [
        { productId: 'filtre-inox', variantId: null, quantity: 9 },
        { productId: 'filtre-inox', variantId: null, quantity: 9 },
      ],
      shippingCountry: 'FR',
    });
    expect(cart.lines[0]!.quantity).toBe(MAX_QUANTITY_PER_LINE);
  });

  it('rejette une quantité hors bornes au niveau du schema', () => {
    expect(() => cartInputSchema.parse({ lines: [{ productId: 'x', quantity: 0 }] })).toThrow();
    expect(() => cartInputSchema.parse({ lines: [{ productId: 'x', quantity: 999 }] })).toThrow();
    expect(() => cartInputSchema.parse({ lines: [] })).toThrow();
  });

  it('offre la livraison au-dela du seuil et la facture en dessous', () => {
    const small = priceCart({
      lines: [{ productId: 'filtre-inox', variantId: null, quantity: 1 }],
      shippingCountry: 'FR',
    });
    expect(small.subtotal).toBeLessThan(FREE_SHIPPING_THRESHOLD);
    expect(small.shipping.price).toBeGreaterThan(0);

    const large = priceCart({
      lines: [{ productId: 'kit-rituel', variantId: null, quantity: 1 }],
      shippingCountry: 'FR',
    });
    expect(large.subtotal).toBeGreaterThanOrEqual(FREE_SHIPPING_THRESHOLD);
    expect(large.shipping.price).toBe(0);
  });

  it('facture la zone UE plus cher que la France', () => {
    const lines = [{ productId: 'filtre-inox', variantId: null, quantity: 1 }];
    const fr = priceCart({ lines, shippingCountry: 'FR' });
    const eu = priceCart({ lines, shippingCountry: 'DE' });
    expect(eu.shipping.price).toBeGreaterThan(fr.shipping.price);
  });

  it('fait tomber le total juste, TVA comprise', () => {
    const cart = priceCart({
      lines: [{ productId: 'kit-rituel', variantId: null, quantity: 1 }],
      shippingCountry: 'FR',
    });
    expect(cart.total).toBe(cart.subtotal + cart.shipping.price);
    expect(cart.netTotal + cart.vat).toBe(cart.total);
  });

  it('additionne le poids, pour le calcul de port', () => {
    const cart = priceCart({
      lines: [{ productId: 'filtre-inox', variantId: null, quantity: 3 }],
      shippingCountry: 'FR',
    });
    expect(cart.totalWeightGrams).toBe(270);
  });

  it('normalise le code pays en majuscules', () => {
    const parsed = cartInputSchema.parse({
      lines: [{ productId: 'kit-rituel', quantity: 1 }],
      shippingCountry: 'fr',
    });
    expect(parsed.shippingCountry).toBe('FR');
  });
});
