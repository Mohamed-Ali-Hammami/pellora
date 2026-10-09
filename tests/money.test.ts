import { describe, it, expect } from 'vitest';
import {
  euros, assertCents, multiply, sum, applyPercentOff, splitVatInclusive,
  formatPrice, savingsPercent, roundCents,
} from '@/lib/money';

describe('money', () => {
  it('convertit les euros en centimes entiers', () => {
    expect(euros(89)).toBe(8900);
    expect(euros(7.8)).toBe(780);
    expect(euros(0.1)).toBe(10);
  });

  it('évite l’erreur de flottant classique', () => {
    // 0.1 + 0.2 === 0.30000000000000004 en flottant.
    expect(sum([euros(0.1), euros(0.2)])).toBe(30);
    expect(euros(19.99) * 3).toBe(5997);
  });

  it('refuse un montant non entier', () => {
    expect(() => assertCents(10.5)).toThrow(/entier de centimes/);
    expect(() => assertCents(Number.NaN)).toThrow();
  });

  it('refuse une quantité invalide', () => {
    expect(() => multiply(1000, -1)).toThrow(/quantité invalide/);
    expect(() => multiply(1000, 1.5)).toThrow(/quantité invalide/);
  });

  it('garantit net + tva === ttc, sans centime perdu', () => {
    // Le cas piegeux : 1 centime n’est pas divisible par 1,2.
    for (const gross of [1, 2, 99, 100, 8900, 14900, 3333, 7]) {
      const { net, vat } = splitVatInclusive(gross);
      expect(net + vat).toBe(gross);
    }
  });

  it('extrait la TVA au lieu de l’ajouter', () => {
    // 89 € TTC contiennent 14,83 € de TVA, et non 17,80 €.
    const { net, vat } = splitVatInclusive(8900);
    expect(net).toBe(7417);
    expect(vat).toBe(1483);
  });

  it('applique une remise en pourcentage', () => {
    expect(applyPercentOff(10000, 10)).toBe(9000);
    expect(applyPercentOff(8900, 0)).toBe(8900);
    expect(() => applyPercentOff(100, 101)).toThrow();
  });

  it('arrondit symetriquement autour de zero', () => {
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(-2.5)).toBe(-3);
  });

  it('calcule le pourcentage d’economie', () => {
    expect(savingsPercent(16800, 14900)).toBe(11);
    // Un prix barre inferieur au prix de vente ne doit rien afficher.
    expect(savingsPercent(5000, 9000)).toBe(0);
    expect(savingsPercent(0, 100)).toBe(0);
  });

  it('formate en euros francais', () => {
    // Espaces insecables inclus : on normalise avant comparaison.
    expect(formatPrice(8900).replace(/ | /g, ' ')).toBe('89,00 €');
  });
});
