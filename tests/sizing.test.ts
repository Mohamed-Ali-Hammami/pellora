import { describe, it, expect } from 'vitest';
import { computeSizing, fitsRange, powerBands, SIZING_LIMITS } from '@/lib/sizing';
import { getStoves } from '@/lib/catalog';

describe('pré-dimensionnement', () => {
  it('raisonne en volume et non en surface', () => {
    // Doubler la hauteur sous plafond doit doubler le besoin : c'est tout
    // l'intérêt de la méthode volumique.
    const low = computeSizing({ areaM2: 100, heightM: 2.5, insulation: 'average', climate: 'temperate' });
    const high = computeSizing({ areaM2: 100, heightM: 5, insulation: 'average', climate: 'temperate' });
    expect(high.nominalKw).toBeCloseTo(low.nominalKw * 2, 1);
  });

  it('demande moins de puissance quand l’isolation est meilleure', () => {
    const base = { areaM2: 120, heightM: 2.5, climate: 'temperate' } as const;
    const poor = computeSizing({ ...base, insulation: 'poor' });
    const average = computeSizing({ ...base, insulation: 'average' });
    const good = computeSizing({ ...base, insulation: 'good' });
    const excellent = computeSizing({ ...base, insulation: 'excellent' });

    expect(poor.nominalKw).toBeGreaterThan(average.nominalKw);
    expect(average.nominalKw).toBeGreaterThan(good.nominalKw);
    expect(good.nominalKw).toBeGreaterThan(excellent.nominalKw);
  });

  it('majore en zone froide et minore en zone douce', () => {
    const base = { areaM2: 100, heightM: 2.5, insulation: 'average' } as const;
    expect(computeSizing({ ...base, climate: 'cold' }).nominalKw).toBeGreaterThan(
      computeSizing({ ...base, climate: 'temperate' }).nominalKw,
    );
    expect(computeSizing({ ...base, climate: 'mild' }).nominalKw).toBeLessThan(
      computeSizing({ ...base, climate: 'temperate' }).nominalKw,
    );
  });

  it('rend une fourchette asymétrique autour du besoin calculé', () => {
    // On tolère 10 % sous le besoin (un poêle est rarement seul) mais
    // seulement 15 % au-dessus : le surdimensionnement est un défaut.
    const result = computeSizing({ areaM2: 100, heightM: 2.5, insulation: 'average', climate: 'temperate' });
    expect(result.minKw).toBeLessThan(result.nominalKw);
    expect(result.maxKw).toBeGreaterThan(result.nominalKw);
    expect(result.nominalKw - result.minKw).toBeLessThan(result.maxKw - result.nominalKw);
  });

  it('borne les saisies aberrantes au lieu de rendre un nombre absurde', () => {
    const tiny = computeSizing({ areaM2: 0, heightM: 0, insulation: 'average', climate: 'temperate' });
    expect(tiny.volumeM3).toBe(SIZING_LIMITS.areaMin * SIZING_LIMITS.heightMin);
    expect(tiny.minKw).toBeGreaterThanOrEqual(2);

    const huge = computeSizing({ areaM2: 100_000, heightM: 99, insulation: 'poor', climate: 'cold' });
    expect(huge.volumeM3).toBe(SIZING_LIMITS.areaMax * SIZING_LIMITS.heightMax);
  });

  it('ne descend jamais sous 2 kW : aucun appareil ne module plus bas', () => {
    const result = computeSizing({ areaM2: 10, heightM: 2, insulation: 'excellent', climate: 'mild' });
    expect(result.minKw).toBeGreaterThanOrEqual(2);
  });

  it('arrondit les bornes au demi-kilowatt', () => {
    const result = computeSizing({ areaM2: 83, heightM: 2.4, insulation: 'good', climate: 'cold' });
    expect((result.minKw * 2) % 1).toBe(0);
    expect((result.maxKw * 2) % 1).toBe(0);
  });

  it('ne retient que les appareils dont le maximum entre dans la fourchette', () => {
    const result = { minKw: 6, maxKw: 9 };
    expect(fitsRange(8, result)).toBe(true);
    expect(fitsRange(6, result)).toBe(true);
    expect(fitsRange(9, result)).toBe(true);
    expect(fitsRange(5.9, result)).toBe(false);
    expect(fitsRange(12, result)).toBe(false);
  });

  it('propose au moins un modèle du catalogue sur un cas courant', () => {
    // Si ce test casse, le calculateur renvoie une liste vide sur le cas le
    // plus fréquent : 90 m², isolation moyenne, climat tempéré.
    const result = computeSizing({ areaM2: 90, heightM: 2.5, insulation: 'average', climate: 'temperate' });
    const matches = getStoves().filter((p) => fitsRange(p.tech?.powerMaxKw ?? 0, result));
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('tranches de puissance du filtre', () => {
  it('couvre toutes les puissances sans trou ni recouvrement', () => {
    const sorted = [...powerBands].sort((a, b) => a.minKw - b.minKw);
    expect(sorted[0]?.minKw).toBe(0);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]?.minKw).toBe(sorted[i - 1]?.maxKw);
    }
    expect(sorted.at(-1)?.maxKw).toBe(Number.POSITIVE_INFINITY);
  });

  it('place chaque poêle du catalogue dans exactement une tranche', () => {
    for (const product of getStoves()) {
      const power = product.tech?.powerMaxKw ?? 0;
      const matching = powerBands.filter((band) => power > band.minKw && power <= band.maxKw);
      expect(matching.length, `${product.id} (${power} kW)`).toBe(1);
    }
  });
});
