import { describe, it, expect } from 'vitest';
import { CartError, MAX_QUANTITY_PER_LINE, addBusinessDays, cartInputSchema, deliveryWindow, priceCart, profileFor, resultOfAdding } from '@/lib/cart';
import { getProductById, unitPrice } from '@/lib/catalog';
import { euros, splitVatInclusive } from '@/lib/money';
import { amountToFreeShipping, freeShippingThreshold, ratesFor, zoneForCountry } from '@/lib/shipping';

interface Line {
  productId: string;
  variantId: string | null;
  quantity: number;
}

/** Panier minimal valide : un accessoire sans variante, donc sans choix requis. */
const accessory: Line = { productId: 'aspirateur-cendres', variantId: null, quantity: 1 };
/** Un poêle : palettisé, avec variantes obligatoires. */
const stove: Line = { productId: 'aria-6', variantId: 'noir', quantity: 1 };

function cart(lines: Line[], country = 'FR', rateId?: string) {
  return priceCart({
    lines,
    shippingCountry: country,
    locale: 'fr',
    ...(rateId ? { shippingRateId: rateId } : {}),
  });
}

describe('validation de l’entrée', () => {
  it('n’accepte du client que des identifiants et des quantités', () => {
    // Le point de sécurité central : si un prix pouvait être envoyé, il
    // suffirait de le modifier dans la console pour payer un centime.
    const parsed = cartInputSchema.parse({
      lines: [{ productId: 'aria-6', variantId: 'noir', quantity: 1, price: 1 }],
      shippingCountry: 'fr',
    });
    expect(parsed).not.toHaveProperty('lines.0.price');
    expect(parsed.lines[0]).not.toHaveProperty('price');
  });

  it('met le pays en majuscules et applique les valeurs par défaut', () => {
    const parsed = cartInputSchema.parse({ lines: [accessory] });
    expect(parsed.shippingCountry).toBe('FR');
    expect(parsed.locale).toBe('fr');
  });

  it('refuse une quantité hors bornes ou non entière', () => {
    expect(() => cartInputSchema.parse({ lines: [{ ...accessory, quantity: 0 }] })).toThrow();
    expect(() => cartInputSchema.parse({ lines: [{ ...accessory, quantity: 1.5 }] })).toThrow();
    expect(() =>
      cartInputSchema.parse({ lines: [{ ...accessory, quantity: MAX_QUANTITY_PER_LINE + 1 }] }),
    ).toThrow();
  });

  it('refuse une langue inconnue', () => {
    expect(() => cartInputSchema.parse({ lines: [accessory], locale: 'de' })).toThrow();
  });
});

describe('tarification du panier', () => {
  it('relit les prix dans le catalogue', () => {
    const priced = cart([stove]);
    const product = getProductById('aria-6');
    expect(product).toBeDefined();
    expect(priced.lines[0]?.unitPrice).toBe(unitPrice(product!, 'noir'));
  });

  it('applique le surcoût de la variante choisie', () => {
    const base = cart([{ ...stove, variantId: 'noir' }]);
    const premium = cart([{ ...stove, variantId: 'bordeaux' }]);
    expect(premium.subtotal).toBeGreaterThan(base.subtotal);
  });

  it('exige un choix de variante quand le produit en a', () => {
    // Sans cela, le prix affiché et le prix facturé pourraient différer.
    expect(() => cart([{ productId: 'aria-6', variantId: null, quantity: 1 }])).toThrow(CartError);
  });

  it('refuse un produit ou une variante inconnus', () => {
    expect(() => cart([{ productId: 'inconnu', variantId: null, quantity: 1 }])).toThrow(CartError);
    expect(() => cart([{ productId: 'aria-6', variantId: 'rose-fluo', quantity: 1 }])).toThrow(CartError);
  });

  it('refuse un panier vide', () => {
    expect(() => priceCart({ lines: [], shippingCountry: 'FR', locale: 'fr' })).toThrow(CartError);
  });

  it('fusionne les lignes en doublon sans dépasser le plafond', () => {
    const priced = cart([
      { ...accessory, quantity: 3 },
      { ...accessory, quantity: 4 },
    ]);
    expect(priced.lines).toHaveLength(1);
    expect(priced.lines[0]?.quantity).toBe(MAX_QUANTITY_PER_LINE);
  });

  it('ne fusionne pas deux variantes différentes du même produit', () => {
    const priced = cart([
      { ...stove, variantId: 'noir' },
      { ...stove, variantId: 'ivoire' },
    ]);
    expect(priced.lines).toHaveLength(2);
  });

  it('additionne sous-total, port et total en centimes entiers', () => {
    const priced = cart([stove]);
    expect(priced.total).toBe(priced.subtotal + priced.shipping.price);
    expect(Number.isInteger(priced.total)).toBe(true);
    expect(Number.isInteger(priced.vat)).toBe(true);
  });

  it('extrait la TVA du total au lieu de l’ajouter', () => {
    // Les prix catalogue sont TTC (obligation d'affichage au consommateur) :
    // ajouter la TVA par-dessus ferait payer 20 % de trop.
    const priced = cart([stove]);
    expect(priced.netTotal + priced.vat).toBe(priced.total);
    expect(priced.vat).toBe(splitVatInclusive(priced.total).vat);
    expect(priced.netTotal).toBeLessThan(priced.total);
  });

  it('retient le délai d’expédition le plus long du panier', () => {
    const priced = cart([stove, { ...accessory }]);
    const slowest = Math.max(
      ...priced.lines.map((line) => line.product.dispatchDaysMax),
    );
    expect(priced.dispatchDaysMax).toBe(slowest);
  });

  it('conserve la langue du parcours', () => {
    const priced = priceCart({ lines: [accessory], shippingCountry: 'NL', locale: 'nl' });
    expect(priced.locale).toBe('nl');
    expect(priced.shipping.label.nl.length).toBeGreaterThan(0);
  });
});

describe('profil de transport', () => {
  it('bascule en palette dès qu’un appareil est au panier', () => {
    expect(cart([accessory]).profile.freight).toBe(false);
    expect(cart([stove]).profile.freight).toBe(true);
    expect(cart([accessory, stove]).profile.freight).toBe(true);
  });

  it('additionne les poids pour chaque unité', () => {
    const product = getProductById('aspirateur-cendres');
    expect(product).toBeDefined();
    const profile = profileFor([{ product: product!, quantity: 3 }]);
    expect(profile.weightGrams).toBe(product!.weightGrams * 3);
  });
});

describe('frais de port', () => {
  it('facture le port palette sous le seuil de franco', () => {
    const priced = cart([stove]);
    expect(priced.shipping.freight).toBe(true);
    expect(priced.shipping.price).toBeGreaterThan(0);
  });

  it('offre le port au-delà du seuil', () => {
    // 3 appareils dépassent le seuil français de franco sur palette.
    const priced = cart([{ ...stove, quantity: 3 }]);
    expect(priced.subtotal).toBeGreaterThanOrEqual(
      freeShippingThreshold('FR', { freight: true, weightGrams: 0 }),
    );
    expect(priced.shipping.price).toBe(0);
  });

  it('applique un tarif plus élevé hors de France', () => {
    const fr = cart([stove], 'FR');
    const es = cart([stove], 'ES');
    expect(es.shipping.price).toBeGreaterThan(fr.shipping.price);
  });

  it('choisit par défaut le tarif le moins cher de la zone', () => {
    const priced = cart([stove]);
    const cheapest = Math.min(
      ...ratesFor(priced.subtotal, zoneForCountry('FR'), priced.profile).map((r) => r.price),
    );
    expect(priced.shipping.price).toBe(cheapest);
  });

  it('respecte un mode de livraison explicitement choisi', () => {
    const priced = cart([stove], 'FR', 'fr-freight-indoor');
    expect(priced.shipping.id).toBe('fr-freight-indoor');
    expect(priced.shipping.price).toBeGreaterThan(cart([stove]).shipping.price);
  });

  it('refuse un mode de livraison inconnu', () => {
    expect(() => cart([stove], 'FR', 'tapis-volant')).toThrow(CartError);
  });

  it('refuse un tarif colis sur un panier palettisé', () => {
    // Le tarif colis existe, mais pas pour ce panier : l'accepter ferait
    // facturer 7 € un transport qui coûte 69 €.
    expect(() => cart([stove], 'FR', 'fr-parcel')).toThrow(CartError);
  });

  it('calcule ce qu’il reste à ajouter pour le franco', () => {
    const profile = { freight: true, weightGrams: 150_000 };
    const threshold = freeShippingThreshold('FR', profile);
    expect(amountToFreeShipping(threshold - euros(10), 'FR', profile)).toBe(euros(10));
    expect(amountToFreeShipping(threshold, 'FR', profile)).toBe(0);
    expect(amountToFreeShipping(threshold + euros(500), 'FR', profile)).toBe(0);
  });
});

describe('fenêtre de livraison', () => {
  it('cumule le délai d’expédition et le délai de transport', () => {
    const priced = cart([stove]);
    const from = new Date('2026-01-05T10:00:00Z'); // un lundi
    const { earliest, latest } = deliveryWindow(priced, from);
    expect(earliest.getTime()).toBeGreaterThan(from.getTime());
    expect(latest.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
  });

  it('saute les samedis et dimanches', () => {
    // Vendredi + 1 jour ouvré = lundi, pas samedi.
    const friday = new Date('2026-01-02T10:00:00Z');
    expect(addBusinessDays(friday, 1).getUTCDay()).toBe(1);
    const monday = new Date('2026-01-05T10:00:00Z');
    expect(addBusinessDays(monday, 5).getUTCDay()).toBe(1);
  });

  it('ne bouge pas pour zéro jour', () => {
    const date = new Date('2026-01-05T10:00:00Z');
    expect(addBusinessDays(date, 0).getTime()).toBe(date.getTime());
  });
});

describe('ce qu’un ajout produit réellement', () => {
  /*
   * Le défaut que ces contrôles verrouillent : le plafond par ligne écrêtait
   * en silence. Demander trois exemplaires quand il en reste deux en ajoutait
   * deux, et le bouton répondait « Ajouté » — le client repartait en croyant
   * en avoir trois, et le découvrait au panier, ou pas du tout.
   */
  it('ajoute tout ce qui est demandé quand le plafond le permet', () => {
    const r = resultOfAdding(0, 3);
    expect(r.added).toBe(3);
    expect(r.quantity).toBe(3);
    expect(r.capped).toBe(false);
  });

  it('signale l’écrêtage et dit combien ont vraiment été ajoutés', () => {
    const r = resultOfAdding(3, 3);
    expect(r.quantity).toBe(MAX_QUANTITY_PER_LINE);
    expect(r.added).toBe(MAX_QUANTITY_PER_LINE - 3);
    expect(r.capped).toBe(true);
  });

  it('signale l’écrêtage même quand rien ne peut plus être ajouté', () => {
    const r = resultOfAdding(MAX_QUANTITY_PER_LINE, 1);
    expect(r.added).toBe(0);
    expect(r.capped).toBe(true);
  });

  it('ne descend jamais sous un exemplaire demandé', () => {
    expect(resultOfAdding(0, 0).requested).toBe(1);
    expect(resultOfAdding(0, -4).requested).toBe(1);
  });

  it('ignore les fractions de quantité', () => {
    expect(resultOfAdding(0, 2.7).added).toBe(2);
  });

  it('respecte le même plafond que le repricing serveur', () => {
    // Si les deux divergent, le client voit une quantité que le serveur
    // refuse, et la commande échoue au dernier écran.
    const cart = priceCart({
      lines: [{ productId: 'aria-6', variantId: 'noir', quantity: MAX_QUANTITY_PER_LINE }],
      shippingCountry: 'FR',
      locale: 'fr',
    });
    expect(cart.lines[0]?.quantity).toBe(resultOfAdding(0, 99).quantity);
  });
});
