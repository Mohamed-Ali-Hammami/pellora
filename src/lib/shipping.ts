/**
 * Règles de livraison.
 *
 * Particularité de la niche : un poêle pèse de 100 à 300 kg. Il ne part pas
 * en colis mais en messagerie palettisée, avec camion à hayon et prise de
 * rendez-vous. Deux conséquences qui structurent ce module :
 *
 *  1. le tarif dépend de la NATURE du panier (palette ou colis) autant que de
 *     sa destination — un thermostat de 240 g et un poêle de 250 kg ne
 *     peuvent pas partager la même grille ;
 *  2. les conditions de réception doivent être annoncées avant paiement.
 *     « Livraison au pied du camion » n'est pas un détail : c'est la première
 *     cause de litige sur ce type de produit, et le client doit savoir qu'il
 *     devra prévoir deux personnes pour rentrer l'appareil.
 */

import { euros, type Cents } from './money';
import { L, type Localized } from './i18n/config';

export type ShippingZone = 'FR' | 'BENELUX' | 'IBERIA' | 'EU';

export interface ShippingRate {
  id: string;
  label: Localized<string>;
  /** Précision affichée sous le libellé, pour lever les ambiguïtés de réception. */
  note: Localized<string>;
  /** Prix TTC. */
  price: Cents;
  minDays: number;
  maxDays: number;
  /** `true` si le transport se fait sur palette avec prise de rendez-vous. */
  freight: boolean;
}

/** Ce que le panier impose au transport. */
export interface ShippingProfile {
  /** `true` dès qu'une ligne du panier est palettisée. */
  freight: boolean;
  /** Poids total expédié, en grammes. */
  weightGrams: number;
}

/**
 * Pays desservis. Hors de cette liste, la commande est refusée AVANT
 * paiement : encaisser puis annoncer qu'on ne livre pas est le plus sûr moyen
 * de déclencher une réclamation auprès de la banque.
 */
export const SHIPPING_COUNTRIES = [
  'FR', 'BE', 'LU', 'NL', 'DE', 'AT', 'IT', 'ES', 'PT', 'IE',
] as const;

export type ShippingCountry = (typeof SHIPPING_COUNTRIES)[number];

export function isShippableCountry(code: string): code is ShippingCountry {
  return (SHIPPING_COUNTRIES as readonly string[]).includes(code);
}

export function zoneForCountry(code: string): ShippingZone {
  switch (code) {
    case 'FR':
      return 'FR';
    case 'BE':
    case 'LU':
    case 'NL':
      return 'BENELUX';
    case 'ES':
    case 'PT':
      return 'IBERIA';
    default:
      return 'EU';
  }
}

/**
 * Seuils de franco de port, par zone et par type d'envoi.
 * Un franco sur palette doit rester haut : à 69 € de transport réel, l'offrir
 * sur un panier de 400 € mange la marge entière de la commande.
 */
const thresholds: Record<ShippingZone, { freight: Cents; parcel: Cents }> = {
  FR: { freight: euros(2490), parcel: euros(150) },
  BENELUX: { freight: euros(2990), parcel: euros(200) },
  IBERIA: { freight: euros(2990), parcel: euros(200) },
  EU: { freight: euros(3490), parcel: euros(250) },
};

const freightPrices: Record<ShippingZone, Cents> = {
  FR: euros(69),
  BENELUX: euros(89),
  IBERIA: euros(129),
  EU: euros(149),
};

const parcelPrices: Record<ShippingZone, Cents> = {
  FR: euros(6.9),
  BENELUX: euros(9.9),
  IBERIA: euros(12.9),
  EU: euros(14.9),
};

const freightDays: Record<ShippingZone, [number, number]> = {
  FR: [4, 8],
  BENELUX: [5, 9],
  IBERIA: [6, 11],
  EU: [6, 12],
};

const parcelDays: Record<ShippingZone, [number, number]> = {
  FR: [2, 4],
  BENELUX: [3, 5],
  IBERIA: [4, 7],
  EU: [4, 7],
};

/** Supplément de mise en place : montage dans la pièce au lieu du seuil. */
const INDOOR_SURCHARGE = euros(119);

const freightNote = L(
  'Camion à hayon, créneau convenu par téléphone. Dépose au pied du camion : prévoyez deux personnes pour rentrer l’appareil.',
  'Tail-lift truck, slot agreed by phone. Kerbside drop-off: plan for two people to move the appliance inside.',
  'Vrachtwagen met laadlift, telefonisch afgesproken tijdvak. Levering naast de wagen: zorg voor twee personen om het toestel binnen te krijgen.',
  'Camión con plataforma, franja acordada por teléfono. Entrega a pie de camión: prevea dos personas para meter el aparato.',
);

const indoorNote = L(
  'Camion à hayon, puis mise en place dans la pièce de votre choix au rez-de-chaussée. Raccordement non inclus.',
  'Tail-lift truck, then positioning in the ground-floor room of your choice. Connection not included.',
  'Vrachtwagen met laadlift, daarna plaatsing in de kamer van uw keuze op de begane grond. Aansluiting niet inbegrepen.',
  'Camión con plataforma y colocación en la estancia que elija en la planta baja. Conexión no incluida.',
);

const parcelNote = L(
  'Colis suivi, remis en main propre ou en point relais.',
  'Tracked parcel, handed over or left at a pickup point.',
  'Gevolgd pakket, persoonlijk overhandigd of naar een afhaalpunt.',
  'Paquete con seguimiento, en mano o en punto de recogida.',
);

const freeLabel = L('Livraison offerte', 'Free delivery', 'Gratis levering', 'Envío gratuito');

/**
 * Tarifs disponibles pour un sous-total, une zone et un profil d'envoi.
 * Le sous-total est TTC, marchandise seule.
 */
export function ratesFor(
  subtotal: Cents,
  zone: ShippingZone,
  profile: ShippingProfile,
): ShippingRate[] {
  if (profile.freight) {
    const free = subtotal >= thresholds[zone].freight;
    const [minDays, maxDays] = freightDays[zone];
    return [
      {
        id: `${zone.toLowerCase()}-freight`,
        label: free
          ? freeLabel
          : L(
              'Livraison sur palette, sur rendez-vous',
              'Palletised delivery, by appointment',
              'Palletlevering op afspraak',
              'Entrega en palet, con cita previa',
            ),
        note: freightNote,
        price: free ? 0 : freightPrices[zone],
        minDays,
        maxDays,
        freight: true,
      },
      {
        id: `${zone.toLowerCase()}-freight-indoor`,
        label: L(
          'Livraison avec mise en place',
          'Delivery with indoor positioning',
          'Levering met plaatsing binnen',
          'Entrega con colocación',
        ),
        note: indoorNote,
        price: (free ? 0 : freightPrices[zone]) + INDOOR_SURCHARGE,
        minDays: minDays + 1,
        maxDays: maxDays + 2,
        freight: true,
      },
    ];
  }

  const free = subtotal >= thresholds[zone].parcel;
  const [minDays, maxDays] = parcelDays[zone];
  return [
    {
      id: `${zone.toLowerCase()}-parcel`,
      label: free
        ? freeLabel
        : L('Colis suivi', 'Tracked parcel', 'Gevolgd pakket', 'Paquete con seguimiento'),
      note: parcelNote,
      price: free ? 0 : parcelPrices[zone],
      minDays,
      maxDays,
      freight: false,
    },
  ];
}

export function findRate(
  subtotal: Cents,
  zone: ShippingZone,
  profile: ShippingProfile,
  rateId: string,
): ShippingRate | undefined {
  return ratesFor(subtotal, zone, profile).find((r) => r.id === rateId);
}

/** Tarif par défaut : le moins cher proposé pour ce panier et cette zone. */
export function defaultRate(
  subtotal: Cents,
  zone: ShippingZone,
  profile: ShippingProfile,
): ShippingRate {
  const rates = ratesFor(subtotal, zone, profile);
  return rates.reduce((best, r) => (r.price < best.price ? r : best), rates[0]!);
}

/** Seuil de franco applicable à ce panier. */
export function freeShippingThreshold(zone: ShippingZone, profile: ShippingProfile): Cents {
  return profile.freight ? thresholds[zone].freight : thresholds[zone].parcel;
}

/** Reste à ajouter pour déclencher le franco de port. 0 si déjà atteint. */
export function amountToFreeShipping(
  subtotal: Cents,
  zone: ShippingZone,
  profile: ShippingProfile,
): Cents {
  return Math.max(0, freeShippingThreshold(zone, profile) - subtotal);
}
