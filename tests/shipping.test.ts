import { describe, it, expect } from 'vitest';
import {
  SHIPPING_COUNTRIES,
  amountToFreeShipping,
  defaultRate,
  findRate,
  freeShippingThreshold,
  isShippableCountry,
  ratesFor,
  zoneForCountry,
  type ShippingProfile,
  type ShippingZone,
} from '@/lib/shipping';
import { euros } from '@/lib/money';
import { locales } from '@/lib/i18n/config';

const zones: readonly ShippingZone[] = ['FR', 'BENELUX', 'IBERIA', 'EU'];
const freight: ShippingProfile = { freight: true, weightGrams: 180_000 };
const parcel: ShippingProfile = { freight: false, weightGrams: 800 };

describe('zones de livraison', () => {
  it('classe chaque pays desservi dans une zone', () => {
    for (const country of SHIPPING_COUNTRIES) {
      expect(zones).toContain(zoneForCountry(country));
    }
  });

  it('place la France, le Benelux et la péninsule ibérique dans leurs zones', () => {
    expect(zoneForCountry('FR')).toBe('FR');
    expect(zoneForCountry('BE')).toBe('BENELUX');
    expect(zoneForCountry('NL')).toBe('BENELUX');
    expect(zoneForCountry('ES')).toBe('IBERIA');
    expect(zoneForCountry('PT')).toBe('IBERIA');
    expect(zoneForCountry('DE')).toBe('EU');
  });

  it('reconnaît les pays desservis et rejette les autres', () => {
    expect(isShippableCountry('FR')).toBe(true);
    expect(isShippableCountry('CH')).toBe(false);
    expect(isShippableCountry('US')).toBe(false);
  });

  it('ne dessert que des pays de l’UE : hors UE, il y aurait de la douane', () => {
    // La Suisse, le Royaume-Uni et la Norvège imposent une déclaration et des
    // droits : les annoncer comme desservis créerait des litiges à la livraison.
    for (const code of ['CH', 'GB', 'NO', 'TR']) {
      expect(isShippableCountry(code), code).toBe(false);
    }
  });
});

describe('grille tarifaire', () => {
  it('propose toujours au moins un tarif, dans chaque zone et pour chaque profil', () => {
    for (const zone of zones) {
      expect(ratesFor(0, zone, freight).length, zone).toBeGreaterThan(0);
      expect(ratesFor(0, zone, parcel).length, zone).toBeGreaterThan(0);
    }
  });

  it('traduit chaque libellé et chaque précision dans les quatre langues', () => {
    for (const zone of zones) {
      for (const rate of [...ratesFor(0, zone, freight), ...ratesFor(0, zone, parcel)]) {
        for (const locale of locales) {
          expect(rate.label[locale].length, `${rate.id}/${locale}`).toBeGreaterThan(0);
          expect(rate.note[locale].length, `${rate.id}/${locale}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it('distingue les tarifs palette des tarifs colis', () => {
    for (const zone of zones) {
      expect(ratesFor(0, zone, freight).every((r) => r.freight)).toBe(true);
      expect(ratesFor(0, zone, parcel).every((r) => !r.freight)).toBe(true);
    }
  });

  it('facture la palette plus cher que le colis', () => {
    for (const zone of zones) {
      const freightPrice = ratesFor(0, zone, freight)[0]?.price ?? 0;
      const parcelPrice = ratesFor(0, zone, parcel)[0]?.price ?? 0;
      expect(freightPrice, zone).toBeGreaterThan(parcelPrice);
    }
  });

  it('annonce un délai croissant avec l’éloignement', () => {
    const fr = ratesFor(0, 'FR', freight)[0];
    const eu = ratesFor(0, 'EU', freight)[0];
    expect(eu?.maxDays ?? 0).toBeGreaterThanOrEqual(fr?.maxDays ?? 0);
  });

  it('a toujours un délai minimum inférieur ou égal au maximum', () => {
    for (const zone of zones) {
      for (const rate of [...ratesFor(0, zone, freight), ...ratesFor(0, zone, parcel)]) {
        expect(rate.minDays, rate.id).toBeLessThanOrEqual(rate.maxDays);
        expect(rate.minDays, rate.id).toBeGreaterThan(0);
      }
    }
  });

  it('offre le port au seuil exact, pas seulement au-delà', () => {
    for (const zone of zones) {
      const threshold = freeShippingThreshold(zone, freight);
      expect(ratesFor(threshold, zone, freight)[0]?.price, zone).toBe(0);
      expect(ratesFor(threshold - 1, zone, freight)[0]?.price, zone).toBeGreaterThan(0);
    }
  });

  it('garde un seuil de franco palette bien plus haut que le seuil colis', () => {
    // À 69 € de transport réel, offrir le port sur un petit panier consomme
    // toute la marge de la commande.
    for (const zone of zones) {
      expect(freeShippingThreshold(zone, freight), zone).toBeGreaterThan(
        freeShippingThreshold(zone, parcel) * 5,
      );
    }
  });

  it('facture le supplément de mise en place même quand le port est offert', () => {
    // La mise en place est une prestation : le franco porte sur le transport,
    // pas sur la main-d'œuvre.
    const threshold = freeShippingThreshold('FR', freight);
    const rates = ratesFor(threshold, 'FR', freight);
    const indoor = rates.find((r) => r.id === 'fr-freight-indoor');
    expect(indoor?.price).toBeGreaterThan(0);
  });

  it('retient le tarif le moins cher par défaut', () => {
    for (const zone of zones) {
      const rates = ratesFor(0, zone, freight);
      const cheapest = Math.min(...rates.map((r) => r.price));
      expect(defaultRate(0, zone, freight).price, zone).toBe(cheapest);
    }
  });

  it('ne retrouve un tarif que dans le profil qui le propose', () => {
    expect(findRate(0, 'FR', freight, 'fr-freight')).toBeDefined();
    expect(findRate(0, 'FR', parcel, 'fr-freight')).toBeUndefined();
    expect(findRate(0, 'FR', freight, 'fr-parcel')).toBeUndefined();
  });

  it('n’a pas deux tarifs de même identifiant dans une zone', () => {
    for (const zone of zones) {
      const ids = ratesFor(0, zone, freight).map((r) => r.id);
      expect(new Set(ids).size, zone).toBe(ids.length);
    }
  });

  it('ne rend jamais un reste à atteindre négatif', () => {
    expect(amountToFreeShipping(euros(100_000), 'FR', freight)).toBe(0);
    expect(amountToFreeShipping(0, 'FR', freight)).toBe(freeShippingThreshold('FR', freight));
  });
});
