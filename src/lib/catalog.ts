/**
 * Catalogue public — SOURCE DE VÉRITÉ unique du site.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ DONNÉES DE DÉMONSTRATION — À REMPLACER AVANT LA PREMIÈRE VENTE        │
 * │                                                                       │
 * │ Les modèles, puissances, rendements, classes énergétiques et prix     │
 * │ ci-dessous sont des valeurs PLAUSIBLES mais FICTIVES, écrites pour    │
 * │ que la boutique soit utilisable de bout en bout. Elles ne décrivent   │
 * │ aucun appareil existant.                                             │
 * │                                                                       │
 * │ Un poêle à granulés est un appareil réglementé : la puissance, le     │
 * │ rendement, les émissions et la classe énergétique doivent reprendre   │
 * │ à l'identique la fiche technique et l'étiquette du fabricant          │
 * │ (règlements UE 2015/1185 et 2015/1186, norme EN 14785). Annoncer une  │
 * │ valeur approximative engage votre responsabilité de vendeur, et rend  │
 * │ par ailleurs le client inéligible aux aides qui exigent une classe    │
 * │ ou un rendement donné.                                               │
 * │                                                                       │
 * │ Remplacez chaque bloc par les données du fournisseur, puis passez     │
 * │ NEXT_PUBLIC_DEMO_CATALOG à « false » pour retirer le bandeau.         │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Ce module est importable côté client : il ne doit donc contenir AUCUNE
 * donnée sensible (prix d'achat, référence fournisseur, marge). Celles-ci
 * vivent dans `sourcing.ts`, qui ne doit jamais être importé par un composant
 * client. `tests/leakage.test.ts` vérifie cette frontière.
 */

import { euros } from './money';
import { L, U, type Locale, type Localized } from './i18n/config';
import type { Product, ProductCategory, SpecRow } from './catalog.types';

/** `true` tant que le catalogue n'a pas été remplacé par de vraies données. */
export const isDemoCatalog = process.env.NEXT_PUBLIC_DEMO_CATALOG !== 'false';

/**
 * Libellés de caractéristiques, mutualisés : un même intitulé doit s'écrire
 * exactement pareil d'une fiche à l'autre, sinon le tableau comparatif
 * devient illisible.
 */
const SPEC = {
  power: L('Puissance', 'Heat output', 'Vermogen', 'Potencia'),
  waterPower: L('Puissance à l’eau', 'Output to water', 'Vermogen naar water', 'Potencia al agua'),
  area: L('Surface chauffée', 'Heated area', 'Verwarmd oppervlak', 'Superficie calentada'),
  efficiency: L('Rendement', 'Efficiency', 'Rendement', 'Rendimiento'),
  energyClass: L('Classe énergétique', 'Energy class', 'Energieklasse', 'Clase energética'),
  hopper: L('Réservoir', 'Hopper', 'Reservoir', 'Depósito'),
  autonomy: L('Autonomie', 'Burn time', 'Autonomie', 'Autonomía'),
  flue: L('Sortie fumées', 'Flue outlet', 'Rookgasafvoer', 'Salida de humos'),
  outlets: L('Sorties canalisables', 'Ducted outlets', 'Kanaalaansluitingen', 'Salidas canalizables'),
  noise: L('Niveau sonore', 'Noise level', 'Geluidsniveau', 'Nivel sonoro'),
  dhw: L('Eau chaude sanitaire', 'Domestic hot water', 'Sanitair warm water', 'Agua caliente sanitaria'),
  dimensions: L('Dimensions (H × L × P)', 'Dimensions (H × W × D)', 'Afmetingen (H × B × D)', 'Dimensiones (Al × An × Pr)'),
  weight: L('Poids', 'Weight', 'Gewicht', 'Peso'),
  standard: L('Norme', 'Standard', 'Norm', 'Norma'),
  warranty: L('Garantie', 'Warranty', 'Garantie', 'Garantía'),
  fuel: L('Combustible', 'Fuel', 'Brandstof', 'Combustible'),
  contents: L('Contenu', 'Contents', 'Inhoud', 'Contenido'),
  material: L('Matière', 'Material', 'Materiaal', 'Material'),
  compatibility: L('Compatibilité', 'Compatibility', 'Compatibiliteit', 'Compatibilidad'),
} as const;

/** Garantie légale de conformité : 2 ans dans toute l'UE (directive 2019/771). */
const WARRANTY_2Y: SpecRow = {
  label: SPEC.warranty,
  value: L(
    '2 ans (garantie légale de conformité)',
    '2 years (statutory conformity guarantee)',
    '2 jaar (wettelijke conformiteitsgarantie)',
    '2 años (garantía legal de conformidad)',
  ),
};

const STANDARD_EN14785: SpecRow = { label: SPEC.standard, value: U('EN 14785') };

const PELLET_FUEL: SpecRow = {
  label: SPEC.fuel,
  value: L(
    'Granulés de bois 6 mm, certifiés DINplus ou ENplus A1',
    '6 mm wood pellets, DINplus or ENplus A1 certified',
    'Houtpellets 6 mm, DINplus of ENplus A1 gecertificeerd',
    'Pellets de madera 6 mm, certificados DINplus o ENplus A1',
  ),
};

/** Visuel de substitution : une illustration, jamais présentée comme une photo. */
function placeholderImage(kind: string, alt: Localized<string>) {
  return { src: `/img/placeholder/${kind}.svg`, alt, placeholder: true as const };
}

export const products: readonly Product[] = [
  // ───────────────────────────────── POÊLES À AIR VENTILÉ ─────────────────────────────────
  {
    id: 'aria-6',
    slug: {
      fr: 'aria-6-poele-air-ventile',
      en: 'aria-6-ducted-air-stove',
      nl: 'aria-6-pelletkachel-ventilatie',
      es: 'aria-6-estufa-aire-ventilado',
    },
    name: 'Pellora Aria 6',
    category: 'air',
    price: euros(1290),
    compareAtPrice: euros(1490),
    tagline: L(
      'La pièce de vie chauffée en vingt minutes, sans toucher à la chaudière.',
      'Your living room warm in twenty minutes, without touching the boiler.',
      'Uw woonkamer warm in twintig minuten, zonder de ketel aan te raken.',
      'El salón caliente en veinte minutos, sin tocar la caldera.',
    ),
    description: L(
      "Le format qui convient à la grande majorité des salons : 6,2 kW, c'est assez pour 60 à 75 m² correctement isolés, et pas trop pour éviter le défaut classique du poêle surdimensionné qui tourne au ralenti et s'encrasse. Le ventilateur souffle l'air chaud en façade, à vitesse réglable, et peut être coupé pour un fonctionnement en convection naturelle le soir. Programmation hebdomadaire sur deux plages par jour.",
      "The size that suits the large majority of living rooms: 6.2 kW is enough for 60 to 75 m² of properly insulated space, and not so much that you hit the classic oversizing problem — a stove idling at minimum output, sooting up its own glass. The fan pushes warm air out at the front at an adjustable speed, and can be switched off for quiet natural convection in the evening. Weekly programming, two slots per day.",
      "Het formaat dat bij de meeste woonkamers past: 6,2 kW is genoeg voor 60 tot 75 m² goed geïsoleerde ruimte, en niet zoveel dat u het klassieke probleem van overdimensionering krijgt — een kachel die op minimum staat en zijn eigen glas vervuilt. De ventilator blaast de warme lucht aan de voorzijde naar buiten, met regelbare snelheid, en kan 's avonds uit voor stille natuurlijke convectie. Weekprogramma met twee tijdvakken per dag.",
      "El tamaño que encaja en la gran mayoría de salones: 6,2 kW bastan para 60 a 75 m² bien aislados, y no tanto como para caer en el problema clásico del sobredimensionado — una estufa al mínimo que ensucia su propio cristal. El ventilador impulsa el aire caliente por el frontal, a velocidad regulable, y puede apagarse para funcionar por convección natural por la noche. Programación semanal en dos franjas diarias.",
    ),
    bullets: {
      fr: [
        'Puissance modulable de 2,1 à 6,2 kW — il descend bas sans s’éteindre',
        'Ventilateur débrayable : convection naturelle le soir, 38 dB(A) en vitesse 1',
        'Réservoir 15 kg — environ 11 h à pleine puissance, 30 h au ralenti',
        'Programmation hebdomadaire, deux plages par jour',
        'Foyer en fonte et brasier en acier démontable sans outil',
      ],
      en: [
        'Modulates from 2.1 to 6.2 kW — it throttles down without going out',
        'Fan can be switched off: natural convection in the evening, 38 dB(A) on speed 1',
        '15 kg hopper — about 11 h at full output, 30 h at minimum',
        'Weekly programming, two slots per day',
        'Cast-iron firebox and steel burn pot, removable without tools',
      ],
      nl: [
        'Moduleert van 2,1 tot 6,2 kW — laag vermogen zonder uit te gaan',
        'Ventilator uitschakelbaar: natuurlijke convectie, 38 dB(A) op stand 1',
        'Reservoir 15 kg — ongeveer 11 u op vol vermogen, 30 u op minimum',
        'Weekprogramma, twee tijdvakken per dag',
        'Gietijzeren vuurhaard en stalen brandkorf, zonder gereedschap uitneembaar',
      ],
      es: [
        'Modula de 2,1 a 6,2 kW — baja sin apagarse',
        'Ventilador desconectable: convección natural, 38 dB(A) en velocidad 1',
        'Depósito de 15 kg — unas 11 h a plena potencia, 30 h al mínimo',
        'Programación semanal, dos franjas por día',
        'Hogar de hierro fundido y cestillo de acero, desmontable sin herramientas',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('2,1 – 6,2 kW') },
      { label: SPEC.area, value: U('60 – 75 m²') },
      { label: SPEC.efficiency, value: U('90,4 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('15 kg') },
      { label: SPEC.autonomy, value: U('11 – 30 h') },
      { label: SPEC.flue, value: U('Ø 80 mm') },
      { label: SPEC.noise, value: U('38 – 46 dB(A)') },
      { label: SPEC.dimensions, value: U('1 020 × 490 × 520 mm') },
      { label: SPEC.weight, value: U('98 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 2.1,
      powerMaxKw: 6.2,
      heatedAreaMinM2: 60,
      heatedAreaMaxM2: 75,
      hopperKg: 15,
      efficiencyPercent: 90.4,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 38,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: 0,
      dimensionsMm: { height: 1020, width: 490, depth: 520 },
      weightKg: 98,
    },
    images: [
      placeholderImage(
        'stove-air',
        L(
          'Poêle à granulés à air ventilé Pellora Aria 6, façade noire et vitre panoramique',
          'Pellora Aria 6 ducted-air pellet stove, black front and panoramic glass',
          'Pellora Aria 6 pelletkachel met ventilatie, zwarte voorzijde en panoramaglas',
          'Estufa de pellets de aire ventilado Pellora Aria 6, frontal negro y cristal panorámico',
        ),
      ),
      placeholderImage(
        'stove-air-detail',
        L(
          'Détail du brasier et de la vitre du Pellora Aria 6',
          'Close-up of the burn pot and glass on the Pellora Aria 6',
          'Detail van brandkorf en glas van de Pellora Aria 6',
          'Detalle del cestillo y el cristal del Pellora Aria 6',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'bordeaux', label: L('Bordeaux', 'Burgundy', 'Bordeaux', 'Burdeos'), priceDelta: euros(60) },
      { id: 'ivoire', label: L('Ivoire', 'Ivory', 'Ivoor', 'Marfil'), priceDelta: euros(60) },
    ],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'granules-palette'],
    hero: true,
    weightGrams: 112_000,
    freight: true,
    badge: L('Le plus vendu', 'Best seller', 'Bestseller', 'Más vendido'),
    dispatchDaysMin: 2,
    dispatchDaysMax: 4,
  },
  {
    id: 'aria-9-canal',
    slug: {
      fr: 'aria-9-canalisable',
      en: 'aria-9-ducted',
      nl: 'aria-9-kanaliseerbaar',
      es: 'aria-9-canalizable',
    },
    name: 'Pellora Aria 9 Canalisable',
    category: 'air',
    price: euros(1890),
    compareAtPrice: null,
    tagline: L(
      'Deux chambres chauffées depuis le salon, par une gaine dans le plafond.',
      'Two bedrooms heated from the living room, through a duct in the ceiling.',
      'Twee slaapkamers verwarmd vanuit de woonkamer, via een kanaal in het plafond.',
      'Dos dormitorios calentados desde el salón, por un conducto en el techo.',
    ),
    description: L(
      "Un poêle canalisable envoie une partie de son air chaud ailleurs que dans la pièce où il se trouve : deux sorties de 80 mm à l'arrière, à raccorder en gaine isolée vers les pièces voisines ou l'étage. Chaque sortie a son propre ventilateur, donc on règle le débit pièce par pièce — ce qui évite la chambre à 24 °C pendant que le salon reste à 19. Comptez 9 kW pour 90 à 110 m² au total, répartition comprise.",
      "A ducted stove sends part of its warm air somewhere other than the room it stands in: two 80 mm outlets at the back, to be connected with insulated duct to adjacent rooms or upstairs. Each outlet has its own fan, so you set the flow room by room — which is what stops the bedroom reaching 24 °C while the living room sits at 19. Reckon on 9 kW for 90 to 110 m² in total, distribution included.",
      "Een kanaliseerbare kachel stuurt een deel van zijn warme lucht ergens anders dan de ruimte waarin hij staat: twee uitgangen van 80 mm aan de achterzijde, aan te sluiten met geïsoleerde kanalen naar aangrenzende kamers of de verdieping. Elke uitgang heeft zijn eigen ventilator, dus u regelt het debiet per kamer — precies wat voorkomt dat de slaapkamer 24 °C haalt terwijl de woonkamer op 19 blijft. Reken op 9 kW voor 90 tot 110 m² in totaal, verdeling inbegrepen.",
      "Una estufa canalizable envía parte de su aire caliente a otro lugar que la habitación donde está: dos salidas de 80 mm en la parte trasera, a conectar con conducto aislado hacia habitaciones contiguas o la planta superior. Cada salida tiene su propio ventilador, así que se regula el caudal habitación por habitación — lo que evita que el dormitorio llegue a 24 °C mientras el salón se queda en 19. Cuente 9 kW para 90 a 110 m² en total, distribución incluida.",
    ),
    bullets: {
      fr: [
        'Deux sorties canalisables Ø 80 mm, ventilateurs indépendants',
        'Puissance modulable de 2,8 à 9,0 kW',
        'Réservoir 22 kg — environ 12 h à pleine puissance',
        'Jusqu’à 6 m de gaine par sortie (isolée, deux coudes maximum)',
        'Télécommande et sonde d’ambiance déportée incluses',
      ],
      en: [
        'Two Ø 80 mm ducted outlets, independently driven fans',
        'Modulates from 2.8 to 9.0 kW',
        '22 kg hopper — about 12 h at full output',
        'Up to 6 m of duct per outlet (insulated, two bends maximum)',
        'Remote control and remote room sensor included',
      ],
      nl: [
        'Twee kanaaluitgangen Ø 80 mm, onafhankelijke ventilatoren',
        'Moduleert van 2,8 tot 9,0 kW',
        'Reservoir 22 kg — ongeveer 12 u op vol vermogen',
        'Tot 6 m kanaal per uitgang (geïsoleerd, maximaal twee bochten)',
        'Afstandsbediening en externe kamersensor meegeleverd',
      ],
      es: [
        'Dos salidas canalizables Ø 80 mm, ventiladores independientes',
        'Modula de 2,8 a 9,0 kW',
        'Depósito de 22 kg — unas 12 h a plena potencia',
        'Hasta 6 m de conducto por salida (aislado, dos codos máximo)',
        'Mando a distancia y sonda de ambiente remota incluidos',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('2,8 – 9,0 kW') },
      { label: SPEC.area, value: U('90 – 110 m²') },
      { label: SPEC.efficiency, value: U('91,2 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('22 kg') },
      { label: SPEC.autonomy, value: U('12 – 34 h') },
      { label: SPEC.outlets, value: U('2 × Ø 80 mm') },
      { label: SPEC.flue, value: U('Ø 80 mm') },
      { label: SPEC.noise, value: U('41 – 49 dB(A)') },
      { label: SPEC.dimensions, value: U('1 110 × 540 × 560 mm') },
      { label: SPEC.weight, value: U('134 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 2.8,
      powerMaxKw: 9,
      heatedAreaMinM2: 90,
      heatedAreaMaxM2: 110,
      hopperKg: 22,
      efficiencyPercent: 91.2,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 41,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: 2,
      dimensionsMm: { height: 1110, width: 540, depth: 560 },
      weightKg: 134,
    },
    images: [
      placeholderImage(
        'stove-air-ducted',
        L(
          'Poêle à granulés canalisable Pellora Aria 9 avec ses deux sorties arrière',
          'Pellora Aria 9 ducted pellet stove with its two rear outlets',
          'Pellora Aria 9 kanaliseerbare pelletkachel met twee uitgangen achteraan',
          'Estufa de pellets canalizable Pellora Aria 9 con sus dos salidas traseras',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'acier', label: L('Acier gris', 'Grey steel', 'Grijs staal', 'Acero gris'), priceDelta: euros(80) },
    ],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'aria-12-duo'],
    hero: true,
    weightGrams: 150_000,
    freight: true,
    badge: L('Pour maison entière', 'Whole-home', 'Hele woning', 'Casa entera'),
    dispatchDaysMin: 2,
    dispatchDaysMax: 5,
  },
  {
    id: 'vela-8-slim',
    slug: {
      fr: 'vela-8-slim-profondeur-reduite',
      en: 'vela-8-slim-shallow-depth',
      nl: 'vela-8-slim-geringe-diepte',
      es: 'vela-8-slim-poco-fondo',
    },
    name: 'Pellora Vela 8 Slim',
    category: 'air',
    price: euros(1990),
    compareAtPrice: euros(2190),
    tagline: L(
      '27 cm de profondeur : il passe là où les autres ne passent pas.',
      '27 cm deep: it fits where the others do not.',
      '27 cm diep: hij past waar de andere niet passen.',
      '27 cm de fondo: entra donde los demás no entran.',
    ),
    description: L(
      "La contrainte la plus fréquente n'est pas la puissance, c'est la place. Avec 27 cm de profondeur hors buse, le Vela se plaque contre un mur de couloir, dans une alcôve de cheminée condamnée ou au bout d'une pièce en longueur, là où un poêle standard de 50 cm obstruerait le passage. Le réservoir se charge par le dessus, en façade, sans avoir à accéder aux côtés — ce qui est le vrai sujet quand l'appareil est encastré.",
      "The most common constraint is not output, it is space. At 27 cm deep excluding the flue spigot, the Vela sits flat against a hallway wall, inside a blocked-up fireplace recess, or at the end of a long narrow room — where a standard 50 cm stove would block the way past. The hopper loads from the top at the front, with no need to reach the sides, which is the real issue once the appliance is recessed.",
      "De meest voorkomende beperking is niet het vermogen, maar de ruimte. Met 27 cm diepte zonder aansluitstuk staat de Vela vlak tegen een gangwand, in een dichtgezette schouwnis of aan het eind van een langwerpige kamer — waar een standaardkachel van 50 cm de doorgang zou blokkeren. Het reservoir wordt aan de bovenzijde vooraan gevuld, zonder bij de zijkanten te hoeven komen, en dat is het werkelijke punt zodra het toestel is ingebouwd.",
      "La limitación más frecuente no es la potencia, es el espacio. Con 27 cm de fondo sin contar la salida, la Vela se pega a la pared de un pasillo, dentro del hueco de una chimenea tapiada o al final de una habitación alargada, donde una estufa estándar de 50 cm cortaría el paso. El depósito se carga por arriba y por delante, sin necesidad de acceder a los lados, que es el verdadero problema cuando el aparato queda encastrado.",
    ),
    bullets: {
      fr: [
        'Profondeur 270 mm hors buse — le format le plus étroit du catalogue',
        'Puissance modulable de 2,4 à 8,0 kW, 80 à 95 m²',
        'Chargement du réservoir par le dessus en façade',
        'Sortie fumées orientable dessus ou arrière',
        'Habillage en tôle laquée, façade sans vis apparentes',
      ],
      en: [
        '270 mm deep excluding the spigot — the narrowest body we stock',
        'Modulates from 2.4 to 8.0 kW, 80 to 95 m²',
        'Hopper loads from the top, at the front',
        'Flue outlet can be set to top or rear',
        'Lacquered steel casing, front panel with no visible screws',
      ],
      nl: [
        '270 mm diep zonder aansluitstuk — het smalste model in ons aanbod',
        'Moduleert van 2,4 tot 8,0 kW, 80 tot 95 m²',
        'Reservoir wordt bovenaan vooraan gevuld',
        'Rookgasafvoer naar boven of naar achter instelbaar',
        'Behuizing van gelakt staal, front zonder zichtbare schroeven',
      ],
      es: [
        '270 mm de fondo sin salida — el cuerpo más estrecho del catálogo',
        'Modula de 2,4 a 8,0 kW, 80 a 95 m²',
        'Depósito con carga por arriba, en el frontal',
        'Salida de humos orientable arriba o atrás',
        'Carrocería de chapa lacada, frontal sin tornillos visibles',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('2,4 – 8,0 kW') },
      { label: SPEC.area, value: U('80 – 95 m²') },
      { label: SPEC.efficiency, value: U('90,8 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('18 kg') },
      { label: SPEC.autonomy, value: U('10 – 28 h') },
      { label: SPEC.flue, value: U('Ø 80 mm, dessus ou arrière') },
      { label: SPEC.noise, value: U('40 – 48 dB(A)') },
      { label: SPEC.dimensions, value: U('1 150 × 900 × 270 mm') },
      { label: SPEC.weight, value: U('118 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 2.4,
      powerMaxKw: 8,
      heatedAreaMinM2: 80,
      heatedAreaMaxM2: 95,
      hopperKg: 18,
      efficiencyPercent: 90.8,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 40,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: 0,
      dimensionsMm: { height: 1150, width: 900, depth: 270 },
      weightKg: 118,
    },
    images: [
      placeholderImage(
        'stove-air-slim',
        L(
          'Poêle à granulés plat Pellora Vela 8 Slim contre un mur',
          'Pellora Vela 8 Slim flat pellet stove against a wall',
          'Pellora Vela 8 Slim platte pelletkachel tegen een muur',
          'Estufa de pellets plana Pellora Vela 8 Slim contra una pared',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'blanc', label: L('Blanc satiné', 'Satin white', 'Satijnwit', 'Blanco satinado'), priceDelta: euros(70) },
    ],
    crossSell: ['kit-conduit-80', 'aria-6', 'aspirateur-cendres'],
    hero: false,
    weightGrams: 132_000,
    freight: true,
    badge: L('Faible profondeur', 'Shallow depth', 'Geringe diepte', 'Poco fondo'),
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },
  {
    id: 'aria-12-duo',
    slug: {
      fr: 'aria-12-duo-grand-volume',
      en: 'aria-12-duo-large-volume',
      nl: 'aria-12-duo-groot-volume',
      es: 'aria-12-duo-gran-volumen',
    },
    name: 'Pellora Aria 12 Duo',
    category: 'air',
    price: euros(2290),
    compareAtPrice: null,
    tagline: L(
      'Pour les volumes ouverts que les 8 kW n’arrivent jamais à tenir.',
      'For the open-plan volumes an 8 kW stove never quite holds.',
      'Voor open volumes die 8 kW nooit helemaal aanhoudt.',
      'Para los volúmenes abiertos que los 8 kW nunca llegan a mantener.',
    ),
    description: L(
      "Un séjour cathédrale, une mezzanine ouverte, une maison ancienne aux murs épais : ce sont les cas où un poêle correctement dimensionné sur le papier n'y arrive pas, parce que le volume réel dépasse largement la surface au sol. 11,8 kW et deux sorties canalisables de 100 mm donnent la réserve nécessaire, avec une modulation qui descend à 3,2 kW pour les demi-saisons où la puissance maximale serait insupportable.",
      "A double-height living room, an open mezzanine, an old house with thick walls: these are the cases where a stove correctly sized on paper still falls short, because the real volume is far greater than the floor area suggests. 11.8 kW and two 100 mm ducted outlets give you the headroom, with modulation down to 3.2 kW for the shoulder seasons when full output would be unbearable.",
      "Een woonkamer met vide, een open mezzanine, een oud huis met dikke muren: dat zijn de gevallen waarin een op papier juist gedimensioneerde kachel het toch niet haalt, omdat het werkelijke volume veel groter is dan de vloeroppervlakte suggereert. 11,8 kW en twee kanaaluitgangen van 100 mm geven de nodige reserve, met modulatie tot 3,2 kW voor de tussenseizoenen waarin vol vermogen ondraaglijk zou zijn.",
      "Un salón a doble altura, un altillo abierto, una casa antigua de muros gruesos: son los casos en que una estufa bien dimensionada sobre el papel no llega, porque el volumen real supera con mucho la superficie del suelo. 11,8 kW y dos salidas canalizables de 100 mm dan el margen necesario, con una modulación que baja a 3,2 kW para los entretiempos en que la potencia máxima sería insoportable.",
    ),
    bullets: {
      fr: [
        'Puissance modulable de 3,2 à 11,8 kW — 120 à 145 m²',
        'Deux sorties canalisables Ø 100 mm, jusqu’à 8 m de gaine',
        'Réservoir 30 kg — environ 13 h à pleine puissance',
        'Double ventilateur tangentiel, 5 vitesses par sortie',
        'Nettoyage automatique du brasier toutes les 2 h de marche',
      ],
      en: [
        'Modulates from 3.2 to 11.8 kW — 120 to 145 m²',
        'Two Ø 100 mm ducted outlets, up to 8 m of duct',
        '30 kg hopper — about 13 h at full output',
        'Twin tangential fans, 5 speeds per outlet',
        'Automatic burn-pot cleaning every 2 h of operation',
      ],
      nl: [
        'Moduleert van 3,2 tot 11,8 kW — 120 tot 145 m²',
        'Twee kanaaluitgangen Ø 100 mm, tot 8 m kanaal',
        'Reservoir 30 kg — ongeveer 13 u op vol vermogen',
        'Dubbele tangentiële ventilator, 5 standen per uitgang',
        'Automatische reiniging van de brandkorf elke 2 bedrijfsuren',
      ],
      es: [
        'Modula de 3,2 a 11,8 kW — 120 a 145 m²',
        'Dos salidas canalizables Ø 100 mm, hasta 8 m de conducto',
        'Depósito de 30 kg — unas 13 h a plena potencia',
        'Doble ventilador tangencial, 5 velocidades por salida',
        'Limpieza automática del cestillo cada 2 h de funcionamiento',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('3,2 – 11,8 kW') },
      { label: SPEC.area, value: U('120 – 145 m²') },
      { label: SPEC.efficiency, value: U('90,1 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('30 kg') },
      { label: SPEC.autonomy, value: U('13 – 36 h') },
      { label: SPEC.outlets, value: U('2 × Ø 100 mm') },
      { label: SPEC.flue, value: U('Ø 80 mm') },
      { label: SPEC.noise, value: U('43 – 52 dB(A)') },
      { label: SPEC.dimensions, value: U('1 210 × 600 × 610 mm') },
      { label: SPEC.weight, value: U('168 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 3.2,
      powerMaxKw: 11.8,
      heatedAreaMinM2: 120,
      heatedAreaMaxM2: 145,
      hopperKg: 30,
      efficiencyPercent: 90.1,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 43,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: 2,
      dimensionsMm: { height: 1210, width: 600, depth: 610 },
      weightKg: 168,
    },
    images: [
      placeholderImage(
        'stove-air-large',
        L(
          'Poêle à granulés canalisable Pellora Aria 12 Duo, grand format',
          'Pellora Aria 12 Duo large-format ducted pellet stove',
          'Pellora Aria 12 Duo kanaliseerbare pelletkachel, groot formaat',
          'Estufa de pellets canalizable Pellora Aria 12 Duo, gran formato',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'anthracite', label: L('Anthracite', 'Anthracite', 'Antraciet', 'Antracita'), priceDelta: euros(90) },
    ],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'idro-15'],
    hero: false,
    weightGrams: 186_000,
    freight: true,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },

  // ───────────────────────────────────── POÊLES HYDRO ─────────────────────────────────────
  {
    id: 'idro-12-compact',
    slug: {
      fr: 'idro-12-compact-hydro',
      en: 'idro-12-compact-hydro',
      nl: 'idro-12-compact-hydro',
      es: 'idro-12-compact-hidro',
    },
    name: 'Pellora Idro 12 Compact',
    category: 'hydro',
    price: euros(2590),
    compareAtPrice: euros(2890),
    tagline: L(
      'Vos radiateurs alimentés au granulé, sans changer de chaudière.',
      'Your radiators run on pellets, without replacing the boiler.',
      'Uw radiatoren op pellets, zonder de ketel te vervangen.',
      'Sus radiadores con pellets, sin cambiar la caldera.',
    ),
    description: L(
      "Un poêle hydro n'envoie pas sa chaleur dans la pièce mais dans l'eau du circuit de chauffage : il alimente les radiateurs ou le plancher chauffant comme le ferait une chaudière, et se pose en relève ou en remplacement d'une chaudière fioul ou gaz. Sur 12 kW, 9,5 partent à l'eau et 2,5 restent dans la pièce d'implantation. Le format convient à une maison de 100 à 120 m² avec un circuit existant en bon état. Le raccordement hydraulique est à faire par un professionnel : circulateur, vase d'expansion et soupape de sécurité sont intégrés, le reste dépend de votre installation.",
      "A hydro stove does not put its heat into the room but into the water of the heating circuit: it feeds radiators or underfloor heating the way a boiler would, and is installed to supplement or replace an oil or gas boiler. Of its 12 kW, 9.5 go to the water and 2.5 stay in the room it stands in. The size suits a 100 to 120 m² house with an existing circuit in good condition. The hydraulic connection must be made by a professional: pump, expansion vessel and safety valve are built in, the rest depends on your installation.",
      "Een hydrokachel brengt zijn warmte niet in de kamer maar in het water van het verwarmingscircuit: hij voedt radiatoren of vloerverwarming zoals een ketel dat zou doen, en wordt geplaatst als aanvulling op of vervanging van een olie- of gasketel. Van de 12 kW gaan er 9,5 naar het water en blijven er 2,5 in de opstellingsruimte. Het formaat past bij een woning van 100 tot 120 m² met een bestaand circuit in goede staat. De hydraulische aansluiting moet door een vakman gebeuren: pomp, expansievat en veiligheidsventiel zijn ingebouwd, de rest hangt af van uw installatie.",
      "Una estufa hidro no lleva su calor a la habitación sino al agua del circuito de calefacción: alimenta radiadores o suelo radiante como lo haría una caldera, y se instala como apoyo o sustitución de una caldera de gasóleo o gas. De sus 12 kW, 9,5 van al agua y 2,5 se quedan en la estancia donde está. El tamaño conviene a una vivienda de 100 a 120 m² con un circuito existente en buen estado. La conexión hidráulica debe hacerla un profesional: bomba, vaso de expansión y válvula de seguridad van integrados, el resto depende de su instalación.",
    ),
    bullets: {
      fr: [
        'Puissance totale 3,5 à 12,0 kW, dont 9,5 kW cédés à l’eau',
        'Circulateur, vase d’expansion 6 L et soupape 3 bar intégrés',
        'Pilotage par sonde de départ d’eau et thermostat d’ambiance',
        'Réservoir 28 kg — environ 11 h à pleine puissance',
        'Compatible appoint sur chaudière existante (fonctionnement en relève)',
      ],
      en: [
        'Total output 3.5 to 12.0 kW, of which 9.5 kW to the water',
        'Built-in pump, 6 L expansion vessel and 3 bar safety valve',
        'Controlled by flow-water sensor and room thermostat',
        '28 kg hopper — about 11 h at full output',
        'Can run alongside an existing boiler as the lead heat source',
      ],
      nl: [
        'Totaal vermogen 3,5 tot 12,0 kW, waarvan 9,5 kW naar het water',
        'Ingebouwde pomp, expansievat 6 L en veiligheidsventiel 3 bar',
        'Regeling via aanvoerwatersensor en kamerthermostaat',
        'Reservoir 28 kg — ongeveer 11 u op vol vermogen',
        'Kan naast een bestaande ketel werken als hoofdwarmtebron',
      ],
      es: [
        'Potencia total 3,5 a 12,0 kW, de los cuales 9,5 kW al agua',
        'Bomba, vaso de expansión de 6 L y válvula de 3 bar integrados',
        'Control por sonda de impulsión y termostato de ambiente',
        'Depósito de 28 kg — unas 11 h a plena potencia',
        'Compatible como apoyo de una caldera existente',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('3,5 – 12,0 kW') },
      { label: SPEC.waterPower, value: U('9,5 kW') },
      { label: SPEC.area, value: U('100 – 120 m²') },
      { label: SPEC.efficiency, value: U('91,6 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('28 kg') },
      { label: SPEC.autonomy, value: U('11 – 30 h') },
      { label: SPEC.dhw, value: L('Non', 'No', 'Nee', 'No') },
      { label: SPEC.flue, value: U('Ø 80 mm') },
      { label: SPEC.dimensions, value: U('1 150 × 560 × 620 mm') },
      { label: SPEC.weight, value: U('192 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 3.5,
      powerMaxKw: 12,
      heatedAreaMinM2: 100,
      heatedAreaMaxM2: 120,
      hopperKg: 28,
      efficiencyPercent: 91.6,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 42,
      waterPowerKw: 9.5,
      domesticHotWater: false,
      ductedOutlets: null,
      dimensionsMm: { height: 1150, width: 560, depth: 620 },
      weightKg: 192,
    },
    images: [
      placeholderImage(
        'stove-hydro',
        L(
          'Poêle à granulés hydro Pellora Idro 12 Compact',
          'Pellora Idro 12 Compact hydro pellet stove',
          'Pellora Idro 12 Compact hydro-pelletkachel',
          'Estufa de pellets hidro Pellora Idro 12 Compact',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'inox', label: L('Habillage inox', 'Stainless casing', 'Rvs behuizing', 'Carcasa inox'), priceDelta: euros(140) },
    ],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'idro-20-ecs'],
    hero: true,
    weightGrams: 212_000,
    freight: true,
    badge: L('Entrée de gamme hydro', 'Entry-level hydro', 'Instapmodel hydro', 'Hidro de entrada'),
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },
  {
    id: 'idro-15',
    slug: {
      fr: 'idro-15-hydro-radiateurs',
      en: 'idro-15-hydro-radiators',
      nl: 'idro-15-hydro-radiatoren',
      es: 'idro-15-hidro-radiadores',
    },
    name: 'Pellora Idro 15',
    category: 'hydro',
    price: euros(2990),
    compareAtPrice: null,
    tagline: L(
      'Le format qui couvre une maison entière sans appoint.',
      'The size that covers a whole house with no back-up.',
      'Het formaat dat een hele woning dekt zonder bijverwarming.',
      'El tamaño que cubre una casa entera sin apoyo.',
    ),
    description: L(
      "15 kW, dont 12 à l'eau : c'est le point où un poêle hydro cesse d'être un appoint pour devenir le générateur principal d'une maison de 130 à 160 m². La régulation module sur la température de retour, ce qui évite les cycles courts qui usent la vis et encrassent l'échangeur. L'échangeur est en acier de 5 mm avec trappes de ramonage accessibles par l'avant, point à vérifier sur tout hydro : un échangeur qu'on ne peut pas nettoyer perd quelques points de rendement par saison.",
      "15 kW, 12 of them to the water: this is the point where a hydro stove stops being a supplement and becomes the main heat source for a 130 to 160 m² house. The control modulates on return temperature, which avoids the short cycles that wear the auger and foul the exchanger. The exchanger is 5 mm steel with sweeping hatches reachable from the front — worth checking on any hydro stove, since an exchanger you cannot clean loses a few points of efficiency every season.",
      "15 kW, waarvan 12 naar het water: dit is het punt waarop een hydrokachel geen bijverwarming meer is maar de hoofdwarmtebron van een woning van 130 tot 160 m². De regeling moduleert op retourtemperatuur, wat de korte cycli voorkomt die de vijzel verslijten en de wisselaar vervuilen. De wisselaar is van 5 mm staal met veegluiken die vooraan bereikbaar zijn — iets om bij elke hydrokachel te controleren, want een wisselaar die u niet kunt reinigen verliest elk seizoen enkele rendementspunten.",
      "15 kW, 12 de ellos al agua: es el punto en que una estufa hidro deja de ser un apoyo para convertirse en el generador principal de una casa de 130 a 160 m². La regulación modula según la temperatura de retorno, lo que evita los ciclos cortos que desgastan el tornillo y ensucian el intercambiador. El intercambiador es de acero de 5 mm con trampillas de limpieza accesibles por delante, un punto a verificar en cualquier hidro: un intercambiador que no se puede limpiar pierde varios puntos de rendimiento cada temporada.",
    ),
    bullets: {
      fr: [
        'Puissance totale 4,2 à 15,0 kW, dont 12,0 kW cédés à l’eau',
        'Échangeur acier 5 mm, trappes de ramonage accessibles en façade',
        'Modulation sur température de retour — pas de cycles courts',
        'Réservoir 35 kg — environ 12 h à pleine puissance',
        'Sorties pour ballon tampon et vanne mélangeuse 3 voies',
      ],
      en: [
        'Total output 4.2 to 15.0 kW, of which 12.0 kW to the water',
        '5 mm steel exchanger, sweeping hatches reachable from the front',
        'Modulation on return temperature — no short cycling',
        '35 kg hopper — about 12 h at full output',
        'Connections for a buffer tank and a 3-way mixing valve',
      ],
      nl: [
        'Totaal vermogen 4,2 tot 15,0 kW, waarvan 12,0 kW naar het water',
        'Wisselaar van 5 mm staal, veegluiken bereikbaar aan de voorzijde',
        'Modulatie op retourtemperatuur — geen korte cycli',
        'Reservoir 35 kg — ongeveer 12 u op vol vermogen',
        'Aansluitingen voor buffervat en 3-weg mengventiel',
      ],
      es: [
        'Potencia total 4,2 a 15,0 kW, de los cuales 12,0 kW al agua',
        'Intercambiador de acero de 5 mm, trampillas accesibles por delante',
        'Modulación según temperatura de retorno — sin ciclos cortos',
        'Depósito de 35 kg — unas 12 h a plena potencia',
        'Salidas para depósito de inercia y válvula mezcladora de 3 vías',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('4,2 – 15,0 kW') },
      { label: SPEC.waterPower, value: U('12,0 kW') },
      { label: SPEC.area, value: U('130 – 160 m²') },
      { label: SPEC.efficiency, value: U('92,1 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('35 kg') },
      { label: SPEC.autonomy, value: U('12 – 33 h') },
      { label: SPEC.dhw, value: L('Non', 'No', 'Nee', 'No') },
      { label: SPEC.flue, value: U('Ø 80 mm') },
      { label: SPEC.dimensions, value: U('1 200 × 580 × 640 mm') },
      { label: SPEC.weight, value: U('218 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 4.2,
      powerMaxKw: 15,
      heatedAreaMinM2: 130,
      heatedAreaMaxM2: 160,
      hopperKg: 35,
      efficiencyPercent: 92.1,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 43,
      waterPowerKw: 12,
      domesticHotWater: false,
      ductedOutlets: null,
      dimensionsMm: { height: 1200, width: 580, depth: 640 },
      weightKg: 218,
    },
    images: [
      placeholderImage(
        'stove-hydro-large',
        L(
          'Poêle à granulés hydro Pellora Idro 15, façade acier',
          'Pellora Idro 15 hydro pellet stove, steel front',
          'Pellora Idro 15 hydro-pelletkachel, stalen front',
          'Estufa de pellets hidro Pellora Idro 15, frontal de acero',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'inox', label: L('Habillage inox', 'Stainless casing', 'Rvs behuizing', 'Carcasa inox'), priceDelta: euros(150) },
    ],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'idro-20-ecs'],
    hero: true,
    weightGrams: 240_000,
    freight: true,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 7,
  },
  {
    id: 'idro-20-ecs',
    slug: {
      fr: 'idro-20-ecs-eau-chaude',
      en: 'idro-20-dhw-hot-water',
      nl: 'idro-20-sww-warm-water',
      es: 'idro-20-acs-agua-caliente',
    },
    name: 'Pellora Idro 20 ECS',
    category: 'hydro',
    price: euros(3690),
    compareAtPrice: euros(3990),
    tagline: L(
      'Le chauffage et l’eau chaude sanitaire sur le même appareil.',
      'Heating and domestic hot water from one appliance.',
      'Verwarming en sanitair warm water uit één toestel.',
      'Calefacción y agua caliente sanitaria en un mismo aparato.',
    ),
    description: L(
      "La version avec production d'eau chaude sanitaire : un échangeur à plaques intégré prépare l'eau chaude instantanément, ce qui permet de couper complètement la chaudière hors saison de chauffe au lieu de la laisser tourner uniquement pour la douche. 20 kW dont 16 à l'eau couvrent 160 à 200 m². Prévoir un ballon tampon si le circuit comporte peu de volume d'eau : c'est ce qui lisse les appels de puissance et évite au poêle de s'arrêter et de redémarrer en permanence.",
      "The version with domestic hot water: a built-in plate heat exchanger prepares hot water on demand, which lets you shut the boiler down entirely outside the heating season instead of leaving it running just for the shower. 20 kW, 16 of them to the water, covers 160 to 200 m². Plan for a buffer tank if the circuit holds little water: that is what smooths out demand and stops the stove constantly starting and stopping.",
      "De versie met sanitair warm water: een ingebouwde platenwisselaar maakt direct warm water, waardoor u de ketel buiten het stookseizoen volledig kunt uitzetten in plaats van hem alleen voor de douche te laten draaien. 20 kW, waarvan 16 naar het water, dekt 160 tot 200 m². Voorzie een buffervat als het circuit weinig waterinhoud heeft: dat vlakt de vraag af en voorkomt dat de kachel voortdurend start en stopt.",
      "La versión con producción de agua caliente sanitaria: un intercambiador de placas integrado prepara el agua caliente al instante, lo que permite apagar por completo la caldera fuera de la temporada de calefacción en lugar de dejarla funcionando solo para la ducha. 20 kW, 16 de ellos al agua, cubren 160 a 200 m². Prevea un depósito de inercia si el circuito tiene poco volumen de agua: es lo que suaviza las demandas y evita que la estufa arranque y pare continuamente.",
    ),
    bullets: {
      fr: [
        'Puissance totale 5,0 à 20,0 kW, dont 16,0 kW cédés à l’eau',
        'Eau chaude sanitaire instantanée par échangeur à plaques',
        'Priorité sanitaire automatique sur la demande de chauffage',
        'Réservoir 42 kg — environ 11 h à pleine puissance',
        'Platine de raccordement pour ballon tampon et vanne 3 voies',
      ],
      en: [
        'Total output 5.0 to 20.0 kW, of which 16.0 kW to the water',
        'Instantaneous domestic hot water via plate exchanger',
        'Automatic hot-water priority over the heating demand',
        '42 kg hopper — about 11 h at full output',
        'Connection board for buffer tank and 3-way valve',
      ],
      nl: [
        'Totaal vermogen 5,0 tot 20,0 kW, waarvan 16,0 kW naar het water',
        'Direct sanitair warm water via platenwisselaar',
        'Automatische voorrang voor warm water boven de verwarmingsvraag',
        'Reservoir 42 kg — ongeveer 11 u op vol vermogen',
        'Aansluitplaat voor buffervat en 3-wegventiel',
      ],
      es: [
        'Potencia total 5,0 a 20,0 kW, de los cuales 16,0 kW al agua',
        'Agua caliente sanitaria instantánea por intercambiador de placas',
        'Prioridad sanitaria automática sobre la demanda de calefacción',
        'Depósito de 42 kg — unas 11 h a plena potencia',
        'Placa de conexión para depósito de inercia y válvula de 3 vías',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('5,0 – 20,0 kW') },
      { label: SPEC.waterPower, value: U('16,0 kW') },
      { label: SPEC.area, value: U('160 – 200 m²') },
      { label: SPEC.efficiency, value: U('92,4 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('42 kg') },
      { label: SPEC.autonomy, value: U('11 – 31 h') },
      { label: SPEC.dhw, value: L('Oui, instantanée', 'Yes, instantaneous', 'Ja, doorstroom', 'Sí, instantánea') },
      { label: SPEC.flue, value: U('Ø 80 mm') },
      { label: SPEC.dimensions, value: U('1 260 × 620 × 660 mm') },
      { label: SPEC.weight, value: U('256 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 5,
      powerMaxKw: 20,
      heatedAreaMinM2: 160,
      heatedAreaMaxM2: 200,
      hopperKg: 42,
      efficiencyPercent: 92.4,
      energyClass: 'A+',
      flueDiameterMm: 80,
      noiseDbA: 44,
      waterPowerKw: 16,
      domesticHotWater: true,
      ductedOutlets: null,
      dimensionsMm: { height: 1260, width: 620, depth: 660 },
      weightKg: 256,
    },
    images: [
      placeholderImage(
        'stove-hydro-dhw',
        L(
          'Poêle à granulés hydro Pellora Idro 20 ECS avec production d’eau chaude',
          'Pellora Idro 20 DHW hydro pellet stove with hot water production',
          'Pellora Idro 20 SWW hydro-pelletkachel met warmwaterproductie',
          'Estufa de pellets hidro Pellora Idro 20 ACS con producción de agua caliente',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'inox', label: L('Habillage inox', 'Stainless casing', 'Rvs behuizing', 'Carcasa inox'), priceDelta: euros(160) },
    ],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'granules-palette'],
    hero: true,
    weightGrams: 280_000,
    freight: true,
    badge: L('Chauffage + eau chaude', 'Heating + hot water', 'Verwarming + warm water', 'Calefacción + ACS'),
    dispatchDaysMin: 4,
    dispatchDaysMax: 8,
  },
  {
    id: 'idro-24-plus',
    slug: {
      fr: 'idro-24-plus-grande-maison',
      en: 'idro-24-plus-large-home',
      nl: 'idro-24-plus-grote-woning',
      es: 'idro-24-plus-casa-grande',
    },
    name: 'Pellora Idro 24 Plus',
    category: 'hydro',
    price: euros(4290),
    compareAtPrice: null,
    tagline: L(
      'Remplace une chaudière fioul, circuit et sanitaire compris.',
      'Replaces an oil boiler, circuit and hot water included.',
      'Vervangt een olieketel, circuit en warm water inbegrepen.',
      'Sustituye una caldera de gasóleo, circuito y ACS incluidos.',
    ),
    description: L(
      "Le haut du catalogue : 24 kW dont 19,5 à l'eau, pensé pour prendre la place d'une chaudière fioul sur une maison de 190 à 240 m² ou un circuit à forte inertie. La vis d'alimentation et le motoréducteur sont dimensionnés pour une marche continue en plein hiver, et le réservoir de 55 kg limite le rechargement à une fois par jour dans ces conditions. À ce niveau de puissance, l'étude du conduit de fumées et le volume du ballon tampon ne sont plus optionnels : écrivez-nous avant de commander, nous vérifions les deux avec vous.",
      "The top of the range: 24 kW with 19.5 to the water, designed to take the place of an oil boiler in a 190 to 240 m² house or on a high-inertia circuit. The auger and gearmotor are sized for continuous running in deep winter, and the 55 kg hopper keeps refilling down to once a day under those conditions. At this output, the flue survey and the buffer-tank volume are no longer optional: write to us before ordering and we will check both with you.",
      "De top van het aanbod: 24 kW waarvan 19,5 naar het water, bedoeld om de plaats van een olieketel in te nemen in een woning van 190 tot 240 m² of op een circuit met hoge inertie. Vijzel en motorreductor zijn gedimensioneerd voor continubedrijf in het hart van de winter, en het reservoir van 55 kg beperkt het bijvullen tot eenmaal per dag onder die omstandigheden. Bij dit vermogen zijn de rookgasafvoerstudie en het buffervolume niet langer optioneel: schrijf ons vóór u bestelt, dan controleren wij beide met u.",
      "Lo más alto del catálogo: 24 kW con 19,5 al agua, pensada para ocupar el lugar de una caldera de gasóleo en una casa de 190 a 240 m² o en un circuito de gran inercia. El tornillo de alimentación y el motorreductor están dimensionados para marcha continua en pleno invierno, y el depósito de 55 kg limita la recarga a una vez al día en esas condiciones. A esta potencia, el estudio del conducto de humos y el volumen del depósito de inercia ya no son opcionales: escríbanos antes de pedir y lo revisamos con usted.",
    ),
    bullets: {
      fr: [
        'Puissance totale 6,0 à 24,0 kW, dont 19,5 kW cédés à l’eau',
        'Eau chaude sanitaire instantanée, priorité automatique',
        'Réservoir 55 kg — un rechargement par jour en plein hiver',
        'Vis et motoréducteur dimensionnés pour marche continue',
        'Conseil de dimensionnement par écrit avant expédition',
      ],
      en: [
        'Total output 6.0 to 24.0 kW, of which 19.5 kW to the water',
        'Instantaneous domestic hot water with automatic priority',
        '55 kg hopper — one refill a day in deep winter',
        'Auger and gearmotor sized for continuous operation',
        'Written sizing advice before we ship',
      ],
      nl: [
        'Totaal vermogen 6,0 tot 24,0 kW, waarvan 19,5 kW naar het water',
        'Direct sanitair warm water met automatische voorrang',
        'Reservoir 55 kg — eenmaal per dag bijvullen in de volle winter',
        'Vijzel en motorreductor voor continubedrijf gedimensioneerd',
        'Schriftelijk dimensioneringsadvies vóór verzending',
      ],
      es: [
        'Potencia total 6,0 a 24,0 kW, de los cuales 19,5 kW al agua',
        'Agua caliente sanitaria instantánea con prioridad automática',
        'Depósito de 55 kg — una recarga al día en pleno invierno',
        'Tornillo y motorreductor dimensionados para marcha continua',
        'Asesoramiento de dimensionado por escrito antes del envío',
      ],
    },
    specs: [
      { label: SPEC.power, value: U('6,0 – 24,0 kW') },
      { label: SPEC.waterPower, value: U('19,5 kW') },
      { label: SPEC.area, value: U('190 – 240 m²') },
      { label: SPEC.efficiency, value: U('92,0 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.hopper, value: U('55 kg') },
      { label: SPEC.autonomy, value: U('12 – 34 h') },
      { label: SPEC.dhw, value: L('Oui, instantanée', 'Yes, instantaneous', 'Ja, doorstroom', 'Sí, instantánea') },
      { label: SPEC.flue, value: U('Ø 100 mm') },
      { label: SPEC.dimensions, value: U('1 340 × 660 × 700 mm') },
      { label: SPEC.weight, value: U('298 kg') },
      PELLET_FUEL,
      STANDARD_EN14785,
      WARRANTY_2Y,
    ],
    tech: {
      powerMinKw: 6,
      powerMaxKw: 24,
      heatedAreaMinM2: 190,
      heatedAreaMaxM2: 240,
      hopperKg: 55,
      efficiencyPercent: 92,
      energyClass: 'A+',
      flueDiameterMm: 100,
      noiseDbA: 46,
      waterPowerKw: 19.5,
      domesticHotWater: true,
      ductedOutlets: null,
      dimensionsMm: { height: 1340, width: 660, depth: 700 },
      weightKg: 298,
    },
    images: [
      placeholderImage(
        'stove-hydro-xl',
        L(
          'Poêle à granulés hydro Pellora Idro 24 Plus, grande puissance',
          'Pellora Idro 24 Plus high-output hydro pellet stove',
          'Pellora Idro 24 Plus hydro-pelletkachel met hoog vermogen',
          'Estufa de pellets hidro Pellora Idro 24 Plus, gran potencia',
        ),
      ),
    ],
    variants: [
      { id: 'noir', label: L('Noir mat', 'Matt black', 'Mat zwart', 'Negro mate'), priceDelta: 0 },
      { id: 'inox', label: L('Habillage inox', 'Stainless casing', 'Rvs behuizing', 'Carcasa inox'), priceDelta: euros(180) },
    ],
    crossSell: ['kit-conduit-80', 'granules-palette', 'idro-20-ecs'],
    hero: false,
    weightGrams: 325_000,
    freight: true,
    badge: null,
    dispatchDaysMin: 5,
    dispatchDaysMax: 10,
  },

  // ────────────────────────────────────── ACCESSOIRES ──────────────────────────────────────
  {
    id: 'kit-conduit-80',
    slug: {
      fr: 'kit-conduit-inox-80mm',
      en: 'stainless-flue-kit-80mm',
      nl: 'rvs-afvoerset-80mm',
      es: 'kit-conducto-inox-80mm',
    },
    name: 'Kit conduit inox 80 mm',
    category: 'accessoire',
    price: euros(349),
    compareAtPrice: null,
    tagline: L(
      'Le conduit double paroi qu’il faut de toute façon acheter.',
      'The twin-wall flue you have to buy anyway.',
      'De dubbelwandige afvoer die u toch moet aanschaffen.',
      'El conducto de doble pared que hay que comprar de todas formas.',
    ),
    description: L(
      "Un poêle à granulés se raccorde en conduit étanche, pas sur un boisseau de cheminée nu : les fumées sont peu chaudes et chargées en condensats acides, qui attaquent la maçonnerie. Ce kit couvre le cas le plus courant — sortie en toiture sur quatre mètres — en inox 316L double paroi avec joints silicone, colliers et plaque d'étanchéité. La pose relève d'un professionnel : elle conditionne votre assurance habitation en cas de sinistre, et le tubage doit respecter la norme applicable chez vous (en France, DTU 24.1).",
      "A pellet stove connects through a sealed flue, not onto a bare masonry chimney: the flue gases are cool and carry acidic condensate that attacks brickwork. This kit covers the most common case — a four-metre roof termination — in 316L twin-wall stainless with silicone seals, clamps and a weathering plate. Installation is a job for a professional: it determines whether your home insurance responds after an incident, and the lining must meet the standard that applies where you live (DTU 24.1 in France).",
      "Een pelletkachel wordt aangesloten op een gasdichte afvoer, niet op een kaal gemetseld kanaal: de rookgassen zijn koel en bevatten zuur condensaat dat het metselwerk aantast. Deze set dekt het meest voorkomende geval — vier meter dakdoorvoer — in dubbelwandig 316L rvs met siliconen afdichtingen, beugels en een dakplaat. De plaatsing is werk voor een vakman: ze bepaalt of uw woonverzekering na schade uitkeert, en de voering moet voldoen aan de norm die bij u geldt.",
      "Una estufa de pellets se conecta con conducto estanco, no sobre un cañón de obra desnudo: los humos son poco calientes y arrastran condensados ácidos que atacan la mampostería. Este kit cubre el caso más habitual — salida a tejado de cuatro metros — en acero inox 316L de doble pared con juntas de silicona, abrazaderas y placa de estanqueidad. La instalación corresponde a un profesional: condiciona su seguro de hogar en caso de siniestro, y el entubado debe cumplir la norma aplicable en su país.",
    ),
    bullets: {
      fr: [
        '4 m de conduit double paroi inox 316L, Ø 80/130 mm',
        'Té de purge, deux coudes 45°, collier mural, plaque d’étanchéité',
        'Joints silicone haute température fournis',
        'Compatible tous les poêles du catalogue en Ø 80 mm',
        'Pose par un professionnel qualifié — non incluse',
      ],
      en: [
        '4 m of 316L twin-wall stainless flue, Ø 80/130 mm',
        'Drain tee, two 45° bends, wall bracket, weathering plate',
        'High-temperature silicone seals supplied',
        'Fits every Ø 80 mm stove in this catalogue',
        'Installation by a qualified professional — not included',
      ],
      nl: [
        '4 m dubbelwandige 316L rvs afvoer, Ø 80/130 mm',
        'Spuistuk, twee bochten 45°, muurbeugel, dakplaat',
        'Hittebestendige siliconen afdichtingen meegeleverd',
        'Past op alle Ø 80 mm kachels in dit aanbod',
        'Plaatsing door een erkend vakman — niet inbegrepen',
      ],
      es: [
        '4 m de conducto de doble pared inox 316L, Ø 80/130 mm',
        'Te de purga, dos codos de 45°, abrazadera mural, placa de estanqueidad',
        'Juntas de silicona de alta temperatura incluidas',
        'Compatible con todas las estufas Ø 80 mm del catálogo',
        'Instalación por profesional cualificado — no incluida',
      ],
    },
    specs: [
      { label: SPEC.contents, value: L('4 m de conduit + raccords', '4 m of flue + fittings', '4 m afvoer + hulpstukken', '4 m de conducto + accesorios') },
      { label: SPEC.material, value: L('Inox 316L double paroi', '316L twin-wall stainless', 'Dubbelwandig 316L rvs', 'Inox 316L doble pared') },
      { label: SPEC.compatibility, value: U('Ø 80 / 130 mm') },
      { label: SPEC.weight, value: U('26 kg') },
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'flue-kit',
        L(
          'Kit de conduit inox double paroi 80 mm avec ses raccords',
          'Twin-wall 80 mm stainless flue kit with its fittings',
          'Dubbelwandige rvs afvoerset 80 mm met hulpstukken',
          'Kit de conducto inox de doble pared 80 mm con sus accesorios',
        ),
      ),
    ],
    variants: [],
    crossSell: ['aria-6', 'idro-15', 'aspirateur-cendres'],
    hero: false,
    weightGrams: 28_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 4,
  },
  {
    id: 'thermostat-wifi',
    slug: {
      fr: 'thermostat-wifi-programmable',
      en: 'wifi-programmable-thermostat',
      nl: 'wifi-thermostaat-programmeerbaar',
      es: 'termostato-wifi-programable',
    },
    name: 'Thermostat Wi-Fi Pellora',
    category: 'accessoire',
    price: euros(149),
    compareAtPrice: euros(179),
    tagline: L(
      'La consigne au bon endroit : la pièce, pas le poêle.',
      'The setpoint where it belongs: the room, not the stove.',
      'De instelwaarde waar hij hoort: in de kamer, niet in de kachel.',
      'La consigna donde debe estar: la habitación, no la estufa.',
    ),
    description: L(
      "La sonde intégrée au poêle mesure la température de l'air juste au-dessus de l'appareil, c'est-à-dire l'endroit le plus chaud de la pièce. Résultat connu : le poêle se coupe alors que le reste du salon est encore froid. Un thermostat déporté règle ce décalage en plaçant la mesure là où vous vivez. Celui-ci se raccorde en contact sec sur l'entrée thermostat du poêle, et se pilote depuis le téléphone pour la programmation hebdomadaire.",
      "The sensor built into a stove measures air temperature just above the appliance — the hottest point in the room. The familiar result: the stove cuts out while the far end of the living room is still cold. A remote thermostat fixes that offset by measuring where you actually sit. This one wires into the stove's dry-contact thermostat input, and handles weekly programming from your phone.",
      "De sensor in de kachel meet de luchttemperatuur net boven het toestel — het warmste punt van de kamer. Het bekende gevolg: de kachel slaat af terwijl de rest van de woonkamer nog koud is. Een externe thermostaat verhelpt die afwijking door te meten waar u zit. Deze wordt aangesloten op het potentiaalvrije thermostaatcontact van de kachel en regelt het weekprogramma via uw telefoon.",
      "La sonda integrada en la estufa mide el aire justo encima del aparato, es decir, el punto más caliente de la sala. El resultado conocido: la estufa se corta mientras el resto del salón sigue frío. Un termostato remoto corrige ese desfase midiendo allí donde usted está. Este se conecta al contacto libre de potencial de la entrada de termostato de la estufa, y gestiona la programación semanal desde el móvil.",
    ),
    bullets: {
      fr: [
        'Contact sec — compatible avec l’entrée thermostat de tous nos poêles',
        'Programmation hebdomadaire, six plages par jour',
        'Application iOS et Android, pilotage à distance',
        'Mesure à ± 0,3 °C, hystérésis réglable',
        'Alimentation secteur ou deux piles AA',
      ],
      en: [
        'Dry contact — works with the thermostat input on all our stoves',
        'Weekly programming, six slots per day',
        'iOS and Android app, remote control',
        'Accurate to ± 0.3 °C, adjustable hysteresis',
        'Mains powered or two AA batteries',
      ],
      nl: [
        'Potentiaalvrij contact — werkt op de thermostaatingang van al onze kachels',
        'Weekprogramma, zes tijdvakken per dag',
        'iOS- en Android-app, bediening op afstand',
        'Nauwkeurigheid ± 0,3 °C, instelbare hysterese',
        'Netvoeding of twee AA-batterijen',
      ],
      es: [
        'Contacto libre de potencial — compatible con todas nuestras estufas',
        'Programación semanal, seis franjas por día',
        'App iOS y Android, control remoto',
        'Precisión ± 0,3 °C, histéresis ajustable',
        'Alimentación de red o dos pilas AA',
      ],
    },
    specs: [
      { label: SPEC.compatibility, value: L('Entrée thermostat contact sec', 'Dry-contact thermostat input', 'Potentiaalvrije thermostaatingang', 'Entrada de termostato libre de potencial') },
      { label: SPEC.contents, value: L('Thermostat, platine murale, visserie', 'Thermostat, wall plate, screws', 'Thermostaat, muurplaat, schroeven', 'Termostato, placa mural, tornillería') },
      { label: SPEC.weight, value: U('240 g') },
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'thermostat',
        L(
          'Thermostat Wi-Fi mural avec écran et molette',
          'Wall-mounted Wi-Fi thermostat with screen and dial',
          'Wifi-thermostaat voor wandmontage met display en draaiknop',
          'Termostato Wi-Fi mural con pantalla y rueda',
        ),
      ),
    ],
    variants: [
      { id: 'blanc', label: L('Blanc', 'White', 'Wit', 'Blanco'), priceDelta: 0 },
      { id: 'noir', label: L('Noir', 'Black', 'Zwart', 'Negro'), priceDelta: 0 },
    ],
    crossSell: ['aria-9-canal', 'idro-15', 'aspirateur-cendres'],
    hero: false,
    weightGrams: 420,
    freight: false,
    badge: null,
    dispatchDaysMin: 1,
    dispatchDaysMax: 3,
  },
  {
    id: 'aspirateur-cendres',
    slug: {
      fr: 'aspirateur-cendres-20l',
      en: 'ash-vacuum-20l',
      nl: 'asstofzuiger-20l',
      es: 'aspirador-cenizas-20l',
    },
    name: 'Aspirateur à cendres 20 L',
    category: 'accessoire',
    price: euros(89),
    compareAtPrice: null,
    tagline: L(
      'Dix minutes par semaine, et le rendement reste celui de la fiche.',
      'Ten minutes a week, and the efficiency stays the one on the data sheet.',
      'Tien minuten per week, en het rendement blijft dat van het typeplaatje.',
      'Diez minutos por semana, y el rendimiento sigue siendo el de la ficha.',
    ),
    description: L(
      "C'est l'accessoire le moins spectaculaire et le plus rentable du lot. Un brasier encrassé et un échangeur empoussiéré font perdre plusieurs points de rendement, donc des granulés, et finissent par déclencher des défauts d'allumage. Un aspirateur à cendres a un filtre métallique et un bac acier qui supportent les résidus fins et encore tièdes, ce qu'un aspirateur domestique ne supporte pas — le filtre papier se colmate en une fois, et les braises résiduelles sont un risque d'incendie réel.",
      "This is the least spectacular and most profitable accessory in the range. A fouled burn pot and a dusty exchanger cost several points of efficiency — so, pellets — and eventually cause ignition faults. An ash vacuum has a metal filter and a steel drum that cope with fine, still-warm residue, which a household vacuum does not: the paper filter clogs in one pass, and leftover embers are a genuine fire risk.",
      "Dit is het minst spectaculaire en meest rendabele accessoire van het assortiment. Een vervuilde brandkorf en een bestofte wisselaar kosten enkele rendementspunten — dus pellets — en leiden uiteindelijk tot ontstekingsstoringen. Een asstofzuiger heeft een metalen filter en een stalen ketel die fijn, nog warm residu verdragen, wat een huishoudstofzuiger niet doet: het papieren filter loopt in één keer vol, en achtergebleven gloeiresten vormen een reëel brandrisico.",
      "Es el accesorio menos espectacular y más rentable del conjunto. Un cestillo sucio y un intercambiador con polvo cuestan varios puntos de rendimiento — es decir, pellets — y acaban provocando fallos de encendido. Un aspirador de cenizas tiene filtro metálico y cubeta de acero que soportan residuos finos y aún templados, lo que un aspirador doméstico no soporta: el filtro de papel se colmata de una vez, y las brasas residuales son un riesgo de incendio real.",
    ),
    bullets: {
      fr: [
        'Cuve acier 20 L, filtre métallique lavable',
        'Flexible et tube métalliques — pas de plastique au contact des cendres',
        'Moteur 800 W, dépression suffisante pour l’échangeur',
        'Cendres froides uniquement : laisser l’appareil refroidir 12 h',
        'Filtre de rechange disponible à l’unité',
      ],
      en: [
        '20 L steel drum, washable metal filter',
        'Metal hose and wand — no plastic in contact with ash',
        '800 W motor, enough suction for the exchanger',
        'Cold ash only: let the appliance cool for 12 h',
        'Replacement filter available separately',
      ],
      nl: [
        'Stalen ketel 20 L, afwasbaar metalen filter',
        'Metalen slang en buis — geen plastic in contact met as',
        'Motor 800 W, voldoende onderdruk voor de wisselaar',
        'Uitsluitend koude as: laat het toestel 12 u afkoelen',
        'Vervangfilter los verkrijgbaar',
      ],
      es: [
        'Cubeta de acero de 20 L, filtro metálico lavable',
        'Manguera y tubo metálicos — sin plástico en contacto con la ceniza',
        'Motor de 800 W, depresión suficiente para el intercambiador',
        'Solo ceniza fría: deje enfriar el aparato 12 h',
        'Filtro de repuesto disponible por separado',
      ],
    },
    specs: [
      { label: SPEC.contents, value: L('Aspirateur, flexible, tube, filtre', 'Vacuum, hose, wand, filter', 'Stofzuiger, slang, buis, filter', 'Aspirador, manguera, tubo, filtro') },
      { label: SPEC.material, value: L('Cuve acier, filtre métal', 'Steel drum, metal filter', 'Stalen ketel, metalen filter', 'Cubeta de acero, filtro metálico') },
      { label: SPEC.weight, value: U('4,6 kg') },
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'ash-vacuum',
        L(
          'Aspirateur à cendres 20 L avec flexible métallique',
          '20 L ash vacuum with metal hose',
          'Asstofzuiger 20 L met metalen slang',
          'Aspirador de cenizas de 20 L con manguera metálica',
        ),
      ),
    ],
    variants: [],
    crossSell: ['aria-6', 'kit-conduit-80', 'granules-palette'],
    hero: false,
    weightGrams: 5200,
    freight: false,
    badge: null,
    dispatchDaysMin: 1,
    dispatchDaysMax: 3,
  },
  {
    id: 'granules-palette',
    slug: {
      fr: 'palette-granules-dinplus-1t',
      en: 'dinplus-pellet-pallet-1t',
      nl: 'pallet-pellets-dinplus-1t',
      es: 'palet-pellets-dinplus-1t',
    },
    name: 'Palette de granulés DINplus — 1 t',
    category: 'accessoire',
    price: euros(449),
    compareAtPrice: null,
    tagline: L(
      'Une tonne livrée, soit une saison pour un poêle de 8 kW.',
      'One tonne delivered — about a season for an 8 kW stove.',
      'Eén ton geleverd — ongeveer één seizoen voor een kachel van 8 kW.',
      'Una tonelada entregada: una temporada para una estufa de 8 kW.',
    ),
    description: L(
      "65 sacs de 15 kg, granulés résineux 6 mm certifiés DINplus. La certification n'est pas un détail marketing : elle borne le taux de cendres, l'humidité et la durabilité mécanique, et c'est ce qui fait la différence entre un brasier propre et un brasier à décrasser deux fois par semaine. Le prix du granulé varie fortement d'une saison à l'autre ; celui affiché ici est valable au moment de la commande, sans engagement sur les livraisons suivantes.",
      "65 bags of 15 kg, 6 mm softwood pellets certified DINplus. The certification is not marketing detail: it caps ash content, moisture and mechanical durability, and that is the difference between a clean burn pot and one you scrape twice a week. Pellet prices move a great deal from season to season; the price shown here applies at the time of ordering, with no commitment on later deliveries.",
      "65 zakken van 15 kg, naaldhoutpellets 6 mm met DINplus-certificaat. Die certificering is geen marketingdetail: ze begrenst asgehalte, vochtigheid en mechanische duurzaamheid, en dat is het verschil tussen een schone brandkorf en een die u twee keer per week moet uitkrabben. Pelletprijzen schommelen sterk per seizoen; de hier vermelde prijs geldt op het moment van bestellen, zonder verbintenis voor latere leveringen.",
      "65 sacos de 15 kg, pellets de conífera de 6 mm certificados DINplus. La certificación no es un detalle de marketing: limita el contenido de cenizas, la humedad y la durabilidad mecánica, y es la diferencia entre un cestillo limpio y uno que hay que rascar dos veces por semana. El precio del pellet varía mucho de una temporada a otra; el mostrado aquí es válido en el momento del pedido, sin compromiso sobre entregas posteriores.",
    ),
    bullets: {
      fr: [
        '65 sacs de 15 kg — 975 kg nets sur palette filmée',
        'Granulés résineux 6 mm, certification DINplus',
        'Taux de cendres ≤ 0,7 %, humidité ≤ 10 %',
        'Livraison au pied du camion, hayon — prévoir un abri sec',
        'Prix valable à la commande, non garanti sur les suivantes',
      ],
      en: [
        '65 bags of 15 kg — 975 kg net on a wrapped pallet',
        '6 mm softwood pellets, DINplus certified',
        'Ash content ≤ 0.7 %, moisture ≤ 10 %',
        'Kerbside delivery with tail lift — have dry storage ready',
        'Price valid at time of order, not guaranteed for later ones',
      ],
      nl: [
        '65 zakken van 15 kg — 975 kg netto op gewikkelde pallet',
        'Naaldhoutpellets 6 mm, DINplus-certificaat',
        'Asgehalte ≤ 0,7 %, vocht ≤ 10 %',
        'Levering naast de vrachtwagen met laadlift — zorg voor droge opslag',
        'Prijs geldig bij bestelling, niet gegarandeerd voor latere',
      ],
      es: [
        '65 sacos de 15 kg — 975 kg netos en palet retractilado',
        'Pellets de conífera 6 mm, certificación DINplus',
        'Contenido de cenizas ≤ 0,7 %, humedad ≤ 10 %',
        'Entrega a pie de camión con plataforma — prevea almacenaje seco',
        'Precio válido en el momento del pedido, no garantizado después',
      ],
    },
    specs: [
      { label: SPEC.contents, value: L('65 sacs de 15 kg', '65 bags of 15 kg', '65 zakken van 15 kg', '65 sacos de 15 kg') },
      { label: SPEC.fuel, value: L('Résineux 6 mm, DINplus', '6 mm softwood, DINplus', 'Naaldhout 6 mm, DINplus', 'Conífera 6 mm, DINplus') },
      { label: SPEC.weight, value: U('975 kg') },
    ],
    tech: null,
    images: [
      placeholderImage(
        'pellets',
        L(
          'Palette filmée de sacs de granulés de bois',
          'Wrapped pallet of wood pellet bags',
          'Gewikkelde pallet met zakken houtpellets',
          'Palet retractilado de sacos de pellets de madera',
        ),
      ),
    ],
    variants: [],
    crossSell: ['aria-6', 'idro-15', 'aspirateur-cendres'],
    hero: false,
    weightGrams: 1_000_000,
    freight: true,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 8,
  },
];

// ──────────────────────────────────────── ACCÈS ────────────────────────────────────────

const byId = new Map(products.map((p) => [p.id, p]));

/**
 * Index slug → produit, par langue. Les slugs sont localisés : une même fiche
 * a quatre URL, et chacune ne doit répondre que dans sa langue pour éviter le
 * contenu dupliqué aux yeux des moteurs de recherche.
 */
const bySlug: Record<Locale, Map<string, Product>> = {
  fr: new Map(products.map((p) => [p.slug.fr, p])),
  en: new Map(products.map((p) => [p.slug.en, p])),
  nl: new Map(products.map((p) => [p.slug.nl, p])),
  es: new Map(products.map((p) => [p.slug.es, p])),
};

export function getProductBySlug(slug: string, locale: Locale): Product | undefined {
  return bySlug[locale].get(slug);
}

export function getProductById(id: string): Product | undefined {
  return byId.get(id);
}

export function getProductsByCategory(category: ProductCategory): readonly Product[] {
  return products.filter((p) => p.category === category);
}

export function getHeroProducts(): readonly Product[] {
  return products.filter((p) => p.hero);
}

/** Poêles uniquement, triés par puissance maximale croissante. */
export function getStoves(): readonly Product[] {
  return products
    .filter((p) => p.tech !== null)
    .slice()
    .sort((a, b) => (a.tech?.powerMaxKw ?? 0) - (b.tech?.powerMaxKw ?? 0));
}

export function getVariant(product: Product, variantId: string | null): Product['variants'][number] | null {
  if (variantId === null) return null;
  return product.variants.find((v) => v.id === variantId) ?? null;
}

/**
 * Prix unitaire effectif TTC pour un couple produit/variante.
 * C'est la SEULE fonction autorisée à déterminer un prix : le serveur la
 * rappelle à la validation du panier pour ne jamais faire confiance au client.
 */
export function unitPrice(product: Product, variantId: string | null): number {
  const variant = getVariant(product, variantId);
  return product.price + (variant?.priceDelta ?? 0);
}

/** Liste des produits référencés par `crossSell`, dans l'ordre et sans trous. */
export function getCrossSell(product: Product): readonly Product[] {
  return product.crossSell.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
}

/** Toutes les URL d'une fiche produit, pour les balises `hreflang`. */
export function productSlugs(product: Product): Localized<string> {
  return product.slug;
}
