/**
 * Pré-dimensionnement de la puissance.
 *
 * Fonctions pures, sans dépendance au navigateur : la même logique sert au
 * calculateur interactif, au filtre de la boutique et aux tests.
 *
 * Honnêteté du modèle — à lire avant de modifier les coefficients : il s'agit
 * d'un calcul par déperdition volumique, la méthode « au doigt mouillé
 * organisé » employée en avant-vente. Les coefficients retenus (0,025 à
 * 0,055 kW/m³) correspondent aux ordres de grandeur couramment utilisés pour
 * un pré-dimensionnement, pas à une norme. Ce calcul ne remplace PAS une
 * étude thermique : il ne voit ni les ponts thermiques, ni l'orientation, ni
 * le renouvellement d'air, ni la surface vitrée. L'interface doit le dire, et
 * elle le dit.
 */

export const insulationLevels = ['poor', 'average', 'good', 'excellent'] as const;
export type InsulationLevel = (typeof insulationLevels)[number];

export const climateZones = ['mild', 'temperate', 'cold'] as const;
export type ClimateZone = (typeof climateZones)[number];

/** Déperdition volumique en kW par m³, par niveau d'isolation. */
const insulationCoefficients: Record<InsulationLevel, number> = {
  poor: 0.055,
  average: 0.042,
  good: 0.032,
  excellent: 0.025,
};

/** Correction climatique appliquée au besoin calculé. */
const climateFactors: Record<ClimateZone, number> = {
  mild: 0.9,
  temperate: 1,
  cold: 1.15,
};

export interface SizingInput {
  /** Surface à chauffer, en m². */
  areaM2: number;
  /** Hauteur sous plafond, en m. */
  heightM: number;
  insulation: InsulationLevel;
  climate: ClimateZone;
}

export interface SizingResult {
  volumeM3: number;
  /** Besoin calculé, en kW, avant mise en fourchette. */
  nominalKw: number;
  /** Fourchette conseillée, bornes arrondies au demi-kilowatt. */
  minKw: number;
  maxKw: number;
}

/** Bornes acceptées en saisie : au-delà, le modèle volumique n'a plus de sens. */
export const SIZING_LIMITS = {
  areaMin: 10,
  areaMax: 500,
  heightMin: 2,
  heightMax: 6,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondi au demi-kilowatt le plus proche. */
function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function computeSizing(input: SizingInput): SizingResult {
  const areaM2 = clamp(input.areaM2, SIZING_LIMITS.areaMin, SIZING_LIMITS.areaMax);
  const heightM = clamp(input.heightM, SIZING_LIMITS.heightMin, SIZING_LIMITS.heightMax);

  const volumeM3 = areaM2 * heightM;
  const nominalKw = volumeM3 * insulationCoefficients[input.insulation] * climateFactors[input.climate];

  // Fourchette asymétrique : on tolère 10 % en dessous du besoin calculé —
  // un poêle n'est presque jamais la seule source de chaleur — mais on
  // n'autorise que 15 % au-dessus, parce qu'un appareil surdimensionné
  // fonctionne en permanence au ralenti, ce qui encrasse la vitre et le
  // brasier et dégrade le rendement réel.
  return {
    volumeM3: Math.round(volumeM3),
    nominalKw: Math.round(nominalKw * 10) / 10,
    minKw: Math.max(2, roundHalf(nominalKw * 0.9)),
    maxKw: roundHalf(nominalKw * 1.15),
  };
}

/** `true` si la puissance maximale d'un appareil entre dans la fourchette conseillée. */
export function fitsRange(powerMaxKw: number, result: Pick<SizingResult, 'minKw' | 'maxKw'>): boolean {
  return powerMaxKw >= result.minKw && powerMaxKw <= result.maxKw;
}

/** Tranches de puissance proposées comme filtre dans la boutique. */
export const powerBands = [
  { id: 'upto8', minKw: 0, maxKw: 8 },
  { id: '8to12', minKw: 8, maxKw: 12 },
  { id: '12to18', minKw: 12, maxKw: 18 },
  { id: 'over18', minKw: 18, maxKw: Number.POSITIVE_INFINITY },
] as const;

export type PowerBandId = (typeof powerBands)[number]['id'];
