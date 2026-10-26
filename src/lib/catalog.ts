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
  reference: L('Référence', 'Reference', 'Referentie', 'Referencia'),
  sealed: L('Appareil étanche', 'Sealed appliance', 'Luchtdicht toestel', 'Aparato estanco'),
  control: L('Pilotage', 'Control', 'Bediening', 'Control'),
  mounting: L('Pose', 'Mounting', 'Montage', 'Instalación'),
  burnerCapacity: L('Capacité du brûleur', 'Burner capacity', 'Brandercapaciteit', 'Capacidad del quemador'),
  ventilation: L('Ventilation', 'Ventilation', 'Ventilatie', 'Ventilación'),
  electricPower: L('Puissance électrique', 'Electrical input', 'Elektrisch vermogen', 'Potencia eléctrica'),
  heatSettings: L('Allures de chauffe', 'Heat settings', 'Verwarmingsstanden', 'Niveles de calor'),
  flameEffect: L('Effet de flamme', 'Flame effect', 'Vlameffect', 'Efecto de llama'),
  supply: L('Alimentation', 'Power supply', 'Voeding', 'Alimentación'),
  /**
   * Volontairement distinct de `area`.
   *
   * `area` est la « surface chauffée », issue d'un essai normalisé sur un
   * appareil de chauffage. Ici, le nombre vient de l'argumentaire du vendeur
   * et n'a pas ce statut : l'intituler pareil laisserait croire qu'un foyer
   * décoratif remplace un poêle.
   */
  areaClaimed: L(
    'Surface annoncée par le fabricant',
    'Area claimed by the manufacturer',
    'Door de fabrikant opgegeven oppervlak',
    'Superficie indicada por el fabricante',
  ),
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

/**
 * Avertissements communs aux foyers décoratifs.
 *
 * Mutualisés pour une raison qui n'est pas la concision : ces quatre lignes
 * sont les seules du catalogue dont la formulation a une portée de sécurité ou
 * de loyauté commerciale. Les recopier douze fois garantirait qu'une seule
 * finisse par diverger — et ce serait précisément celle-là qui compterait.
 */

/** Bioéthanol : flamme nue, combustible liquide. */
const ETHANOL_FUEL: SpecRow = {
  label: SPEC.fuel,
  value: L(
    'Bioéthanol liquide pour foyer décoratif',
    'Liquid bioethanol for decorative hearths',
    'Vloeibare bio-ethanol voor sierhaarden',
    'Bioetanol líquido para hogar decorativo',
  ),
};

/**
 * La contrainte qu'un acheteur doit lire AVANT d'acheter, pas dans la notice.
 *
 * Un brûleur à bioéthanol consomme l'oxygène de la pièce et y rejette du CO₂
 * et de la vapeur d'eau : il n'a pas de conduit, donc tout reste à
 * l'intérieur. C'est l'exact revers de son argument de vente.
 */
const VENTILATION_REQUIRED: SpecRow = {
  label: SPEC.ventilation,
  value: L(
    'Pièce ventilée obligatoire — la combustion rejette CO₂ et vapeur d’eau dans la pièce',
    'Ventilated room required — combustion releases CO₂ and water vapour into the room',
    'Geventileerde ruimte verplicht — verbranding geeft CO₂ en waterdamp af in de ruimte',
    'Habitación ventilada obligatoria — la combustión libera CO₂ y vapor de agua en la habitación',
  ),
};

/** Foyers électriques : une prise domestique ordinaire, rien de plus. */
const ELECTRIC_SUPPLY: SpecRow = {
  label: SPEC.supply,
  value: U('230 V ~ 50 Hz'),
};

/**
 * Dire que la flamme est fausse, en toutes lettres.
 *
 * Un foyer électrique se vend sur l'image d'une flamme. Laisser l'acheteur la
 * découvrir à la livraison serait une pratique commerciale trompeuse — et de
 * toute façon un retour.
 */
const FLAME_SIMULATED: SpecRow = {
  label: SPEC.flameEffect,
  value: L(
    'Simulation lumineuse — aucune combustion, aucune flamme réelle',
    'Lit simulation — no combustion, no real flame',
    'Lichtsimulatie — geen verbranding, geen echte vlam',
    'Simulación luminosa — sin combustión, sin llama real',
  ),
};


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
  // ───────────────────────── PRODUIT RÉEL — ETNA Luxe ─────────────────────────
  //
  // Seule fiche du catalogue dont les caractéristiques viennent de la
  // documentation du fabricant, d'où `dataVerified: true`.
  //
  // RESTE À CONFIRMER auprès de la fiche technique ETNA, et signalé par un
  // `null` plutôt que par une valeur inventée : puissance minimale de
  // modulation, rendement exact, capacité du réservoir, diamètre de sortie des
  // fumées, dimensions, poids, niveau sonore.
  //
  // PRIX ET COÛT D'ACHAT PROVISOIRES : à remplacer avant toute vente.
  {
    id: 'anna-12',
    slug: {
      fr: 'etna-anna-12-poele-granules-etanche-canalisable',
      en: 'etna-anna-12-sealed-ducted-pellet-stove',
      nl: 'etna-anna-12-luchtdichte-kanaliseerbare-pelletkachel',
      es: 'etna-anna-12-estufa-pellets-estanca-canalizable',
    },
    name: 'ETNA Luxe Anna 12EC',
    category: 'pellet',
    distribution: 'air',
    price: euros(2490),
    compareAtPrice: null,
    tagline: L(
      'Étanche : l’air de combustion vient de l’extérieur, pas de votre salon.',
      'Sealed: combustion air comes from outside, not from your living room.',
      'Luchtdicht: de verbrandingslucht komt van buiten, niet uit uw woonkamer.',
      'Estanca: el aire de combustión viene del exterior, no de su salón.',
    ),
    description: L(
      "Un poêle étanche prend son air de combustion directement dehors, par un conduit concentrique, au lieu de le puiser dans la pièce. Deux conséquences : plus de courant d’air froid aspiré vers l’appareil, et une installation possible dans une maison RT 2012 ou BBC, où un poêle non étanche met le logement en dépression. L’Anna y ajoute une sortie canalisable pour envoyer une partie de l’air chaud vers une deuxième pièce, une vitre teintée sur toute la hauteur de la façade, et une autonomie annoncée jusqu’à vingt heures. La télécommande est fournie ; le module Wi-Fi est en option.",
      "A sealed stove draws its combustion air straight from outside through a concentric flue, instead of taking it from the room. Two consequences: no more cold draught pulled toward the appliance, and installation becomes possible in a low-energy or airtight house, where a non-sealed stove puts the building under negative pressure. The Anna adds a ducted outlet to send part of the warm air to a second room, a tinted glass panel running the full height of the front, and a stated burn time of up to twenty hours. The remote control is supplied; the Wi-Fi module is an option.",
      "Een luchtdichte kachel haalt zijn verbrandingslucht rechtstreeks van buiten via een concentrische afvoer, in plaats van uit de kamer. Twee gevolgen: geen koude trek meer naar het toestel, en plaatsing wordt mogelijk in een lage-energiewoning, waar een niet-luchtdichte kachel onderdruk veroorzaakt. De Anna voegt daar een kanaaluitgang aan toe om een deel van de warme lucht naar een tweede kamer te sturen, getint glas over de volle hoogte van het front, en een opgegeven autonomie tot twintig uur. De afstandsbediening wordt meegeleverd; de wifimodule is optioneel.",
      "Una estufa estanca toma su aire de combustión directamente del exterior, por un conducto concéntrico, en lugar de cogerlo de la estancia. Dos consecuencias: se acaba la corriente de aire frío hacia el aparato, y la instalación resulta posible en una vivienda de baja demanda energética, donde una estufa no estanca pone el edificio en depresión. La Anna añade una salida canalizable para enviar parte del aire caliente a una segunda habitación, un cristal tintado en toda la altura del frontal, y una autonomía declarada de hasta veinte horas. El mando a distancia se incluye; el módulo Wi-Fi es opcional.",
    ),
    bullets: {
      fr: [
        'Étanche — installable en zone 1, 2 ou 3, sortie des fumées en façade ou en toiture',
        'Sortie canalisable pour chauffer une deuxième pièce',
        'Surface de chauffe annoncée jusqu’à 90 m²',
        'Autonomie annoncée jusqu’à 20 h en fonctionnement continu',
        'Vitre teintée intégrale et système double porte, vitre extérieure trempée',
        'Télécommande incluse, module Wi-Fi en option',
      ],
      en: [
        'Sealed — installable in zones 1, 2 or 3, flue through the wall or the roof',
        'Ducted outlet to heat a second room',
        'Stated heated area up to 90 m²',
        'Stated burn time up to 20 h of continuous operation',
        'Full-height tinted glass and twin-door system, tempered outer pane',
        'Remote control included, Wi-Fi module optional',
      ],
      nl: [
        'Luchtdicht — plaatsbaar in zone 1, 2 of 3, afvoer door gevel of dak',
        'Kanaaluitgang om een tweede kamer te verwarmen',
        'Opgegeven verwarmd oppervlak tot 90 m²',
        'Opgegeven autonomie tot 20 u continu bedrijf',
        'Getint glas over de volle hoogte en dubbeldeursysteem, gehard buitenglas',
        'Afstandsbediening meegeleverd, wifimodule optioneel',
      ],
      es: [
        'Estanca — instalable en zona 1, 2 o 3, salida de humos por fachada o tejado',
        'Salida canalizable para calentar una segunda habitación',
        'Superficie calentada declarada hasta 90 m²',
        'Autonomía declarada hasta 20 h de funcionamiento continuo',
        'Cristal tintado en toda la altura y sistema de doble puerta, vidrio exterior templado',
        'Mando a distancia incluido, módulo Wi-Fi opcional',
      ],
    },
    specs: [
      { label: SPEC.reference, value: U('ANNA 12EC') },
      {
        label: SPEC.power,
        value: L(
          '10 kW (puissance de l’étiquette énergétique)',
          '10 kW (figure on the energy label)',
          '10 kW (waarde op het energielabel)',
          '10 kW (valor de la etiqueta energética)',
        ),
      },
      { label: SPEC.area, value: L('Jusqu’à 90 m²', 'Up to 90 m²', 'Tot 90 m²', 'Hasta 90 m²') },
      { label: SPEC.efficiency, value: U('> 92 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.autonomy, value: L('Jusqu’à 20 h', 'Up to 20 h', 'Tot 20 u', 'Hasta 20 h') },
      { label: SPEC.outlets, value: L('1 sortie canalisable', '1 ducted outlet', '1 kanaaluitgang', '1 salida canalizable') },
      {
        label: SPEC.sealed,
        value: L(
          'Oui — zones d’installation 1, 2 ou 3',
          'Yes — installation zones 1, 2 or 3',
          'Ja — plaatsingszones 1, 2 of 3',
          'Sí — zonas de instalación 1, 2 o 3',
        ),
      },
      {
        label: SPEC.control,
        value: L(
          'Télécommande incluse, Wi-Fi en option',
          'Remote control included, Wi-Fi optional',
          'Afstandsbediening meegeleverd, wifi optioneel',
          'Mando incluido, Wi-Fi opcional',
        ),
      },
      PELLET_FUEL,
      { label: SPEC.standard, value: U('EN 14785 · règlement UE 2015/1186') },
      WARRANTY_2Y,
    ],
    tech: {
      // Valeur de l'étiquette énergétique, qui est le document opposable.
      // La désignation commerciale annonce 12 kW : l'écart est signalé au
      // client sur la fiche et reste à trancher avec le fabricant.
      powerMaxKw: 10,
      powerMinKw: null,
      heatedAreaMinM2: null,
      heatedAreaMaxM2: 90,
      hopperKg: null,
      efficiencyPercent: null,
      energyClass: 'A+',
      flueDiameterMm: null,
      noiseDbA: null,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: 1,
      dimensionsMm: null,
      weightKg: null,
    },
    images: [
      placeholderImage(
        'stove-air-ducted',
        L(
          'Poêle à granulés étanche ETNA Luxe Anna 12EC, corps cylindrique et vitre teintée',
          'ETNA Luxe Anna 12EC sealed pellet stove, cylindrical body and tinted glass',
          'ETNA Luxe Anna 12EC luchtdichte pelletkachel, cilindrische behuizing en getint glas',
          'Estufa de pellets estanca ETNA Luxe Anna 12EC, cuerpo cilíndrico y cristal tintado',
        ),
      ),
    ],
    variants: [],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'granules-palette'],
    hero: true,
    dataVerified: true,
    // Poids provisoire, le temps d'avoir la fiche technique. Il ne sert qu'à
    // l'information : le tarif de transport dépend du drapeau `freight`.
    weightGrams: 140_000,
    freight: true,
    badge: L('Poêle étanche', 'Sealed stove', 'Luchtdichte kachel', 'Estufa estanca'),
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },
  // ETNA Vertigo Up — données issues de la documentation ETNA transmise par
  // l'exploitant et de l'étiquette énergétique, d'où `dataVerified: true`.
  //
  // ÉCART DE PUISSANCE, VOLONTAIREMENT NON ARBITRÉ : la désignation
  // commerciale annonce 9,2 kW, l'étiquette énergétique déclare 8,3 kW. C'est
  // l'étiquette qui fait foi ici — c'est le document opposable, et sous-estimer
  // la puissance est la seule erreur des deux qui ne se retourne pas contre
  // l'acheteur. Le nom du produit ne porte donc aucun chiffre, pour ne pas se
  // contredire lui-même, et la fiche affiche les deux valeurs.
  //
  // RESTE À CONFIRMER, signalé par `null` plutôt que par une valeur inventée :
  // puissance minimale de modulation, rendement exact, capacité du réservoir,
  // diamètre de la sortie concentrique, dimensions, poids, niveau sonore — le
  // produit est annoncé « ultra silencieux » sans chiffre, ce qui ne se met pas
  // dans un champ en dB.
  //
  // PRIX ET COÛT D'ACHAT PROVISOIRES : à remplacer avant toute vente.
  {
    id: 'vertigo-up',
    slug: {
      fr: 'etna-vertigo-up-poele-granules-etanche-sortie-dessus',
      en: 'etna-vertigo-up-sealed-pellet-stove-top-outlet',
      nl: 'etna-vertigo-up-luchtdichte-pelletkachel-bovenafvoer',
      es: 'etna-vertigo-up-estufa-pellets-estanca-salida-superior',
    },
    name: 'ETNA Vertigo Up',
    category: 'pellet',
    distribution: 'air',
    price: euros(2790),
    compareAtPrice: null,
    tagline: L(
      'La sortie des fumées passe par le dessus : le poêle se colle au mur.',
      'The flue leaves through the top: the stove sits right against the wall.',
      'De rookgasafvoer gaat via de bovenkant: de kachel staat vlak tegen de muur.',
      'La salida de humos pasa por arriba: la estufa se pega a la pared.',
    ),
    description: L(
      "Sur la plupart des poêles, la sortie des fumées part à l'arrière, et il faut laisser passer le coude : quinze à vingt centimètres perdus contre le mur, sur toute la largeur de l'appareil. Le Vertigo Up sort par le dessus, en conduit concentrique — l'air de combustion descend par l'enveloppe extérieure pendant que les fumées montent par l'intérieur. L'appareil se place donc nettement plus près de la cloison, ce qui change la donne dans une pièce étroite ou devant un mur déjà meublé. Étanche, il prend son air dehors et s'installe en logement BBC. La vitre Magic Glass reste noire tant que le feu n'est pas allumé, et le corps rond en verre et métal se regarde de tous les côtés, ce qui compte quand le poêle n'est pas contre un mur plein.",
      'On most stoves the flue leaves at the back, and the elbow needs room: fifteen to twenty centimetres lost against the wall, across the full width of the appliance. The Vertigo Up exits through the top, through a concentric flue — combustion air comes down the outer sleeve while the flue gases rise inside it. The stove therefore sits markedly closer to the wall, which changes things in a narrow room or in front of a wall that already holds furniture. Being sealed, it takes its air from outside and can go into an airtight house. The Magic Glass pane stays black until the fire is lit, and the round body in glass and metal reads well from every side, which matters when the stove is not against a solid wall.',
      'Bij de meeste kachels zit de rookgasafvoer aan de achterkant, en de bocht vraagt ruimte: vijftien tot twintig centimeter verloren tegen de muur, over de volle breedte van het toestel. De Vertigo Up gaat er via de bovenkant uit, met een concentrische afvoer — de verbrandingslucht komt via de buitenmantel naar beneden terwijl de rookgassen er binnenin omhoog gaan. De kachel staat daardoor merkbaar dichter bij de wand, wat scheelt in een smalle kamer of voor een muur die al vol staat. Luchtdicht haalt hij zijn lucht van buiten en kan hij in een lage-energiewoning. Het Magic Glass blijft zwart zolang het vuur niet brandt, en de ronde behuizing in glas en metaal oogt van alle kanten goed, wat telt als de kachel niet tegen een dichte muur staat.',
      'En la mayoría de las estufas la salida de humos va por detrás, y el codo necesita sitio: quince a veinte centímetros perdidos contra la pared, en todo el ancho del aparato. La Vertigo Up sale por arriba, con conducto concéntrico: el aire de combustión baja por la envolvente exterior mientras los humos suben por dentro. La estufa queda así bastante más cerca del tabique, lo que cambia las cosas en una estancia estrecha o ante una pared ya amueblada. Al ser estanca, toma el aire del exterior y puede instalarse en vivienda de baja demanda energética. El cristal Magic Glass permanece negro mientras el fuego no está encendido, y el cuerpo redondo en vidrio y metal se mira bien desde todos los lados, lo que importa cuando la estufa no está contra un muro ciego.',
    ),
    bullets: {
      fr: [
        'Sortie concentrique par le dessus — installation plus près du mur',
        'Étanche — zones d’installation 1, 2 ou 3',
        'Magic Glass : la vitre reste opaque hors combustion',
        'Surface de chauffe annoncée : environ 90 m²',
        'Autonomie annoncée jusqu’à 20 h en fonctionnement continu',
        'Télécommande incluse, module Wi-Fi en option',
        'Appareil annoncé recyclable à 85 %',
      ],
      en: [
        'Concentric flue through the top — fits closer to the wall',
        'Sealed — installation zones 1, 2 or 3',
        'Magic Glass: the pane stays opaque when the fire is out',
        'Stated heated area: about 90 m²',
        'Stated burn time up to 20 h of continuous operation',
        'Remote control included, Wi-Fi module optional',
        'Appliance stated to be 85 % recyclable',
      ],
      nl: [
        'Concentrische afvoer via de bovenkant — staat dichter bij de muur',
        'Luchtdicht — plaatsingszones 1, 2 of 3',
        'Magic Glass: het glas blijft ondoorzichtig als het vuur uit is',
        'Opgegeven verwarmd oppervlak: ongeveer 90 m²',
        'Opgegeven autonomie tot 20 u continu bedrijf',
        'Afstandsbediening meegeleverd, wifimodule optioneel',
        'Toestel opgegeven als 85 % recyclebaar',
      ],
      es: [
        'Salida concéntrica por arriba — se instala más cerca de la pared',
        'Estanca — zonas de instalación 1, 2 o 3',
        'Magic Glass: el cristal permanece opaco con el fuego apagado',
        'Superficie de calefacción declarada: unos 90 m²',
        'Autonomía declarada de hasta 20 h en continuo',
        'Mando a distancia incluido, módulo Wi-Fi opcional',
        'Aparato declarado reciclable al 85 %',
      ],
    },
    specs: [
      {
        label: SPEC.power,
        value: L(
          '8,3 kW (étiquette énergétique) — 9,2 kW en désignation commerciale',
          '8.3 kW (energy label) — 9.2 kW as marketed',
          '8,3 kW (energielabel) — 9,2 kW in de handelsbenaming',
          '8,3 kW (etiqueta energética) — 9,2 kW en la denominación comercial',
        ),
      },
      { label: SPEC.area, value: L('Environ 90 m²', 'About 90 m²', 'Ongeveer 90 m²', 'Unos 90 m²') },
      { label: SPEC.efficiency, value: U('> 90 %') },
      { label: SPEC.energyClass, value: U('A+') },
      { label: SPEC.autonomy, value: L('Jusqu’à 20 h', 'Up to 20 h', 'Tot 20 u', 'Hasta 20 h') },
      {
        label: SPEC.flue,
        value: L(
          'Concentrique, par le dessus',
          'Concentric, through the top',
          'Concentrisch, via de bovenkant',
          'Concéntrica, por arriba',
        ),
      },
      {
        label: SPEC.sealed,
        value: L(
          'Oui — zones d’installation 1, 2 ou 3',
          'Yes — installation zones 1, 2 or 3',
          'Ja — plaatsingszones 1, 2 of 3',
          'Sí — zonas de instalación 1, 2 o 3',
        ),
      },
      {
        label: SPEC.noise,
        value: L(
          'Annoncé « ultra silencieux » — aucun niveau en dB communiqué',
          'Stated “ultra quiet” — no dB figure supplied',
          'Opgegeven als “ultrastil” — geen dB-waarde opgegeven',
          'Declarada «ultrasilenciosa» — sin valor en dB facilitado',
        ),
      },
      {
        label: SPEC.control,
        value: L(
          'Télécommande incluse, Wi-Fi en option',
          'Remote control included, Wi-Fi optional',
          'Afstandsbediening meegeleverd, wifi optioneel',
          'Mando incluido, Wi-Fi opcional',
        ),
      },
      PELLET_FUEL,
      { label: SPEC.standard, value: U('EN 14785 · règlement UE 2015/1186') },
      WARRANTY_2Y,
    ],
    tech: {
      // Valeur de l'étiquette énergétique : voir la note en tête de fiche.
      powerMaxKw: 8.3,
      powerMinKw: null,
      heatedAreaMinM2: null,
      heatedAreaMaxM2: 90,
      hopperKg: null,
      efficiencyPercent: null,
      energyClass: 'A+',
      flueDiameterMm: null,
      noiseDbA: null,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: null,
      dimensionsMm: null,
      weightKg: null,
    },
    images: [
      placeholderImage(
        'stove-air',
        L(
          'Poêle à granulés étanche ETNA Vertigo Up, corps rond en verre et métal, sortie des fumées par le dessus',
          'ETNA Vertigo Up sealed pellet stove, round body in glass and metal, flue through the top',
          'ETNA Vertigo Up luchtdichte pelletkachel, ronde behuizing in glas en metaal, afvoer via de bovenkant',
          'Estufa de pellets estanca ETNA Vertigo Up, cuerpo redondo en vidrio y metal, salida de humos por arriba',
        ),
      ),
    ],
    variants: [],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'granules-palette'],
    hero: true,
    dataVerified: true,
    // Poids provisoire, le temps d'avoir la fiche technique. Il ne sert qu'à
    // l'information : le tarif de transport dépend du drapeau `freight`.
    weightGrams: 135_000,
    freight: true,
    badge: L('Sortie par le dessus', 'Top flue outlet', 'Afvoer bovenaan', 'Salida por arriba'),
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },
  // ETNA Vulcano Silenzio Up — même plateforme technique que le Vertigo Up
  // (étanche, sortie concentrique supérieure, mêmes puissances), dans un corps
  // rectangulaire au lieu du corps rond.
  //
  // PUISSANCE : l'étiquette énergétique, reçue cette fois en taille réelle et
  // parfaitement lisible, porte « ETNA · VULCANO · A+ · 8,3 kW · 2015/1186 ».
  // La désignation commerciale annonce 9,2 kW. Même arbitrage que pour les
  // deux fiches précédentes : l'étiquette alimente `powerMaxKw`, et la fiche
  // affiche les deux valeurs.
  //
  // PAS ENCORE DE PHOTOGRAPHIE : les trois visuels produit sont arrivés en
  // 125 px et `media:scan` les a écartés. L'étiquette est mise de côté sous
  // `_etiquette-energie.webp` — seule à être exploitable, elle deviendrait la
  // vignette du produit dans toutes les grilles. La fiche porte donc
  // l'illustration de substitution et la mention qui va avec.
  //
  // RESTE À CONFIRMER, signalé par `null` : puissance minimale, rendement,
  // réservoir, diamètre de sortie, dimensions, poids, niveau sonore.
  //
  // PRIX ET COÛT D'ACHAT PROVISOIRES.
  {
    id: 'vulcano-silenzio-up',
    slug: {
      fr: 'etna-vulcano-silenzio-up-poele-granules-etanche-sortie-dessus',
      en: 'etna-vulcano-silenzio-up-sealed-pellet-stove-top-outlet',
      nl: 'etna-vulcano-silenzio-up-luchtdichte-pelletkachel-bovenafvoer',
      es: 'etna-vulcano-silenzio-up-estufa-pellets-estanca-salida-superior',
    },
    name: 'ETNA Vulcano Silenzio Up',
    category: 'pellet',
    distribution: 'air',
    price: euros(2690),
    compareAtPrice: null,
    tagline: L(
      'La sortie par le dessus du Vertigo, dans un corps droit qui se range contre un mur.',
      'The Vertigo’s top flue outlet, in a straight body that tucks against a wall.',
      'De bovenafvoer van de Vertigo, in een rechte behuizing die tegen een muur past.',
      'La salida superior del Vertigo, en un cuerpo recto que se arrima a la pared.',
    ),
    description: L(
      "Le Vulcano Silenzio Up partage la plateforme du Vertigo Up : même étanchéité, même sortie concentrique par le dessus — l'air de combustion descend par l'enveloppe extérieure du conduit pendant que les fumées montent par l'intérieur — et donc le même gain de place, l'appareil n'ayant plus à réserver l'espace d'un coude arrière. La différence est la forme : un corps rectangulaire à façade plane, qui s'aligne sur un mur ou s'encastre entre deux meubles là où le corps rond du Vertigo demande à être vu de tous les côtés. Le constructeur le classe parmi ses modèles les plus silencieux, sans publier de niveau sonore mesuré.",
      'The Vulcano Silenzio Up shares the Vertigo Up’s platform: the same sealed construction, the same concentric flue through the top — combustion air comes down the outer sleeve while the flue gases rise inside it — and therefore the same saving in space, since no room is needed for a rear elbow. The difference is the shape: a rectangular body with a flat front, which lines up against a wall or slots between two units, where the Vertigo’s round body asks to be seen from every side. The manufacturer ranks it among its quietest models, without publishing a measured noise level.',
      'De Vulcano Silenzio Up deelt het platform van de Vertigo Up: dezelfde luchtdichte bouw, dezelfde concentrische afvoer via de bovenkant — de verbrandingslucht komt via de buitenmantel naar beneden terwijl de rookgassen er binnenin omhoog gaan — en dus dezelfde ruimtewinst, want er hoeft geen plaats te zijn voor een bocht achteraan. Het verschil is de vorm: een rechthoekige behuizing met vlak front, die tegen een muur aansluit of tussen twee kasten past, waar de ronde Vertigo van alle kanten gezien wil worden. De fabrikant rekent hem tot zijn stilste modellen, zonder een gemeten geluidsniveau te publiceren.',
      'La Vulcano Silenzio Up comparte la plataforma de la Vertigo Up: la misma estanqueidad, la misma salida concéntrica por arriba —el aire de combustión baja por la envolvente exterior mientras los humos suben por dentro— y por tanto el mismo ahorro de espacio, ya que no hay que reservar sitio para un codo trasero. La diferencia es la forma: un cuerpo rectangular de frontal plano, que se alinea contra una pared o encaja entre dos muebles, donde el cuerpo redondo de la Vertigo pide verse por todos los lados. El fabricante la sitúa entre sus modelos más silenciosos, sin publicar un nivel sonoro medido.',
    ),
    bullets: {
      fr: [
        'Sortie concentrique par le dessus — installation plus près du mur',
        'Étanche — zones d’installation 1, 2 ou 3',
        'Corps rectangulaire à façade plane, pensé pour s’aligner sur un mur',
        'Classé « ultra-silencieux » par le constructeur',
        'Classe énergétique A+ — étiquette vérifiée',
        'Télécommande incluse, module Wi-Fi en option',
      ],
      en: [
        'Concentric flue through the top — fits closer to the wall',
        'Sealed — installation zones 1, 2 or 3',
        'Rectangular body with a flat front, meant to line up against a wall',
        'Ranked “ultra-quiet” by the manufacturer',
        'Energy class A+ — label verified',
        'Remote control included, Wi-Fi module optional',
      ],
      nl: [
        'Concentrische afvoer via de bovenkant — staat dichter bij de muur',
        'Luchtdicht — plaatsingszones 1, 2 of 3',
        'Rechthoekige behuizing met vlak front, om tegen een muur aan te sluiten',
        'Door de fabrikant als “ultrastil” aangeduid',
        'Energieklasse A+ — label geverifieerd',
        'Afstandsbediening meegeleverd, wifimodule optioneel',
      ],
      es: [
        'Salida concéntrica por arriba — se instala más cerca de la pared',
        'Estanca — zonas de instalación 1, 2 o 3',
        'Cuerpo rectangular de frontal plano, pensado para alinearse con la pared',
        'Clasificada «ultrasilenciosa» por el fabricante',
        'Clase energética A+ — etiqueta verificada',
        'Mando a distancia incluido, módulo Wi-Fi opcional',
      ],
    },
    specs: [
      {
        label: SPEC.power,
        value: L(
          '8,3 kW (étiquette énergétique) — 9,2 kW en désignation commerciale',
          '8.3 kW (energy label) — 9.2 kW as marketed',
          '8,3 kW (energielabel) — 9,2 kW in de handelsbenaming',
          '8,3 kW (etiqueta energética) — 9,2 kW en la denominación comercial',
        ),
      },
      { label: SPEC.energyClass, value: U('A+') },
      {
        label: SPEC.flue,
        value: L(
          'Concentrique, par le dessus',
          'Concentric, through the top',
          'Concentrisch, via de bovenkant',
          'Concéntrica, por arriba',
        ),
      },
      {
        label: SPEC.sealed,
        value: L(
          'Oui — zones d’installation 1, 2 ou 3',
          'Yes — installation zones 1, 2 or 3',
          'Ja — plaatsingszones 1, 2 of 3',
          'Sí — zonas de instalación 1, 2 o 3',
        ),
      },
      {
        label: SPEC.noise,
        value: L(
          'Annoncé « ultra-silencieux » — aucun niveau en dB communiqué',
          'Stated “ultra-quiet” — no dB figure supplied',
          'Opgegeven als “ultrastil” — geen dB-waarde opgegeven',
          'Declarada «ultrasilenciosa» — sin valor en dB facilitado',
        ),
      },
      {
        label: SPEC.control,
        value: L(
          'Télécommande incluse, Wi-Fi en option',
          'Remote control included, Wi-Fi optional',
          'Afstandsbediening meegeleverd, wifi optioneel',
          'Mando incluido, Wi-Fi opcional',
        ),
      },
      PELLET_FUEL,
      { label: SPEC.standard, value: U('EN 14785 · règlement UE 2015/1186') },
      WARRANTY_2Y,
    ],
    tech: {
      // Étiquette énergétique ETNA « VULCANO », lue en taille réelle.
      powerMaxKw: 8.3,
      powerMinKw: null,
      heatedAreaMinM2: null,
      // Non communiquée pour ce modèle. Reprise de la plateforme commune au
      // Vertigo Up, dont la documentation annonce environ 90 m² à puissance
      // identique — à confirmer sur la fiche technique du Vulcano.
      heatedAreaMaxM2: 90,
      hopperKg: null,
      efficiencyPercent: null,
      energyClass: 'A+',
      flueDiameterMm: null,
      noiseDbA: null,
      waterPowerKw: null,
      domesticHotWater: false,
      ductedOutlets: null,
      dimensionsMm: null,
      weightKg: null,
    },
    images: [
      placeholderImage(
        'stove-air',
        L(
          'Poêle à granulés étanche ETNA Vulcano Silenzio Up, corps rectangulaire, sortie des fumées par le dessus',
          'ETNA Vulcano Silenzio Up sealed pellet stove, rectangular body, flue through the top',
          'ETNA Vulcano Silenzio Up luchtdichte pelletkachel, rechthoekige behuizing, afvoer via de bovenkant',
          'Estufa de pellets estanca ETNA Vulcano Silenzio Up, cuerpo rectangular, salida de humos por arriba',
        ),
      ),
    ],
    variants: [],
    crossSell: ['kit-conduit-80', 'thermostat-wifi', 'granules-palette'],
    hero: false,
    dataVerified: true,
    weightGrams: 130_000,
    freight: true,
    badge: L('Sortie par le dessus', 'Top flue outlet', 'Afvoer bovenaan', 'Salida por arriba'),
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },
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
    category: 'pellet',
    distribution: 'air',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'air',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'air',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'air',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'hydro',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'hydro',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'hydro',
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
    dataVerified: false,
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
    category: 'pellet',
    distribution: 'hydro',
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
    dataVerified: false,
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
    category: 'flue',
    distribution: null,
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
    dataVerified: false,
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
    category: 'accessory',
    distribution: null,
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
    dataVerified: false,
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
    category: 'accessory',
    distribution: null,
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
    dataVerified: false,
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
    category: 'accessory',
    distribution: null,
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
    dataVerified: false,
    weightGrams: 1_000_000,
    freight: true,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 8,
  },

  // ══════════════════════════ FOYERS DÉCORATIFS ══════════════════════════
  //
  // PROVENANCE DES DONNÉES, ET CE QU'ELLE VAUT.
  //
  // Les douze fiches qui suivent — six bioéthanol, six électriques — sont
  // bâties sur un relevé de la place de marché ManoMano Espagne d'octobre
  // 2026, conservé dans `data/releves/`. Chaque fiche porte en commentaire
  // l'URL de l'annonce dont elle reprend le modèle et le prix observé.
  //
  // Ce que ce relevé contient réellement : nom commercial, marque,
  // dimensions, capacité du brûleur, autonomie, puissance électrique — quand
  // le vendeur les annonce. Rien d'autre. Une annonce de place de marché
  // n'est PAS une fiche technique de fabricant : elle ne porte ni déclaration
  // de conformité, ni rendement, ni poids pesé. D'où `dataVerified: false`
  // sur les douze, et des poids explicitement marqués ESTIMÉS.
  //
  // CE QUI RESTE À FAIRE AVANT LA PREMIÈRE VENTE, dans cet ordre :
  //   1. choisir un fournisseur et obtenir son tarif — les coûts d'achat de
  //      `sourcing.ts` sont calculés depuis le prix de vente, pas négociés ;
  //   2. récupérer la déclaration de conformité et la notice de chaque modèle ;
  //   3. peser un exemplaire emballé : le poids commande le prix du port, et
  //      une erreur de 10 kg se paie à chaque expédition ;
  //   4. obtenir les visuels — media pack du fournisseur ou photos propres.
  //      Les images de ManoMano appartiennent à ses vendeurs.
  //
  // PRIX DE VENTE : arrondi au 0,90 € immédiatement supérieur au prix observé
  // sur la place de marché. C'est un alignement sur le marché, pas un calcul
  // de marge ; la marge se vérifie avec `npm run economics` une fois les vrais
  // coûts d'achat saisis.
  //
  // POURQUOI CES DEUX FAMILLES NE SONT PAS DES « APPAREILS » dans le modèle :
  // voir le commentaire de `applianceCategories` dans `catalog.types.ts`.
  // Conséquence directe et voulue : `tech: null`, `distribution: null`, et
  // aucune de ces fiches n'apparaît dans le calculateur de puissance.

  // Relevé : https://www.manomano.es/p/biochimenea-de-sobremesa-kekai-etna-355x18x205cm-quemador-de-acero-inoxidable-proteccion-de-vidrio-templado-y-extintor-manual-76349104
  // Prix observé 36,96 €.
  {
    id: 'bio-etna-table',
    slug: {
      fr: 'kekai-etna-cheminee-bioethanol-de-table',
      en: 'kekai-etna-tabletop-bioethanol-fireplace',
      nl: 'kekai-etna-bio-ethanolhaard-voor-tafel',
      es: 'kekai-etna-chimenea-de-bioetanol-de-sobremesa',
    },
    name: 'KEKAI Etna',
    category: 'bioethanol',
    distribution: null,
    price: euros(39.9),
    compareAtPrice: null,
    tagline: L(
      'Une flamme sur la table, sans installation ni conduit.',
      'A flame on the table, with no installation and no flue.',
      'Een vlam op tafel, zonder installatie en zonder rookkanaal.',
      'Una llama sobre la mesa, sin instalación ni conducto.',
    ),
    description: L(
      'Le plus petit format du rayon : un brûleur en acier inoxydable posé dans un socle de 35,5 cm, protégé par une vitre en verre trempé. On le remplit de bioéthanol, on l’allume, et c’est tout — ni raccordement, ni conduit, ni prise. C’est un objet de décoration pour une table ou un rebord de cheminée, et pas un chauffage : ne comptez pas sur lui pour réchauffer une pièce.',
      'The smallest format in the range: a stainless steel burner set in a 35.5 cm base, shielded by tempered glass. Fill it with bioethanol, light it, done — no connection, no flue, no socket. It is a decorative object for a table or a mantelpiece, not a heater: do not expect it to warm a room.',
      'Het kleinste formaat van het assortiment: een roestvrijstalen brander in een voet van 35,5 cm, beschermd door gehard glas. Vullen met bio-ethanol, aansteken, klaar — geen aansluiting, geen rookkanaal, geen stopcontact. Het is een decoratief object voor een tafel of schoorsteenmantel, geen verwarming: verwacht niet dat het een kamer opwarmt.',
      'El formato más pequeño de la gama: un quemador de acero inoxidable montado en una base de 35,5 cm, protegido por vidrio templado. Se llena de bioetanol, se enciende y listo — sin conexión, sin conducto, sin enchufe. Es un objeto decorativo para una mesa o una repisa, no una calefacción: no espere que caliente una habitación.',
    ),
    bullets: {
      fr: [
        'Brûleur en acier inoxydable, protection en verre trempé',
        'Aucun conduit, aucun raccordement, aucune prise électrique',
        'Format de table : 35,5 × 18 × 20,5 cm',
        'Objet décoratif — ne remplace pas un appareil de chauffage',
        'À utiliser dans une pièce ventilée, jamais remplir un brûleur chaud',
      ],
      en: [
        'Stainless steel burner, tempered glass shield',
        'No flue, no connection, no mains socket',
        'Tabletop size: 35.5 × 18 × 20.5 cm',
        'Decorative object — not a replacement for a heating appliance',
        'Use in a ventilated room, never refill a hot burner',
      ],
      nl: [
        'Roestvrijstalen brander, scherm van gehard glas',
        'Geen rookkanaal, geen aansluiting, geen stopcontact',
        'Tafelformaat: 35,5 × 18 × 20,5 cm',
        'Decoratief object — vervangt geen verwarmingstoestel',
        'Gebruik in een geventileerde ruimte, vul nooit een warme brander bij',
      ],
      es: [
        'Quemador de acero inoxidable, protección de vidrio templado',
        'Sin conducto, sin conexión, sin enchufe',
        'Formato de sobremesa: 35,5 × 18 × 20,5 cm',
        'Objeto decorativo — no sustituye a un aparato de calefacción',
        'Úselo en una habitación ventilada, nunca rellene un quemador caliente',
      ],
    },
    specs: [
      ETHANOL_FUEL,
      { label: SPEC.mounting, value: L(
        'Posable',
        'Tabletop',
        'Op tafel',
        'De sobremesa',
      ) },
      { label: SPEC.material, value: L(
        'Acier inoxydable, verre trempé',
        'Stainless steel, tempered glass',
        'Roestvrij staal, gehard glas',
        'Acero inoxidable, vidrio templado',
      ) },
      { label: SPEC.dimensions, value: U('20,5 × 35,5 × 18 cm') },
      VENTILATION_REQUIRED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'bioethanol-table',
        L(
          'Foyer bioéthanol de table avec brûleur inox et vitre de protection',
          'Tabletop bioethanol burner with stainless burner and glass shield',
          'Bio-ethanolhaard voor tafel met rvs-brander en glazen scherm',
          'Chimenea de bioetanol de sobremesa con quemador inox y vidrio',
        ),
      ),
    ],
    variants: [],
    crossSell: ['bio-homcom-floor', 'bio-mauna-loa'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (2.8 kg emballé) — à peser avant la première expédition.
    weightGrams: 2_800,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 5,
  },
  // Relevé : https://www.manomano.es/p/homcom-chimenea-de-bioetanol-de-pie-con-tanque-de-09-l-apagallamas-de-acero-inoxidable-tiempo-de-combustion-33h-para-15-20-m-38x22x54-cm-negro-88179379
  // Prix observé 39,99 €.
  // Le vendeur annonce « 15-20 m² ». C’est un argumentaire, pas un essai : d’où le libellé
  // « surface annoncée par le fabricant » et non « surface chauffée ».
  {
    id: 'bio-homcom-floor',
    slug: {
      fr: 'homcom-cheminee-bioethanol-sur-pied-0-9-l',
      en: 'homcom-freestanding-bioethanol-fireplace-0-9-l',
      nl: 'homcom-vrijstaande-bio-ethanolhaard-0-9-l',
      es: 'homcom-chimenea-de-bioetanol-de-pie-0-9-l',
    },
    name: 'HOMCOM 820-333V70',
    category: 'bioethanol',
    distribution: null,
    price: euros(44.9),
    compareAtPrice: null,
    tagline: L(
      'Un foyer debout, 3 h 20 de flamme par remplissage.',
      'A standing hearth, 3 h 20 of flame per fill.',
      'Een staande haard, 3 u 20 vlam per vulling.',
      'Un hogar de pie, 3 h 20 de llama por llenado.',
    ),
    description: L(
      'Un foyer sur pied de 54 cm de haut, en acier, avec un réservoir de 0,9 litre qui tient environ 3 h 20 par remplissage et un couvercle étouffoir en acier inoxydable pour éteindre la flamme sans attendre qu’elle meure seule. Le fabricant parle de 15 à 20 m² : prenez-le comme une indication d’ambiance, pas comme une puissance de chauffage — un brûleur à bioéthanol de ce format apporte une chaleur d’appoint, rien de plus.',
      'A 54 cm tall freestanding steel hearth with a 0.9 litre tank good for roughly 3 h 20 per fill, and a stainless steel snuffer lid to put the flame out rather than wait for it to die. The maker quotes 15 to 20 m²: read that as ambience, not as heating output — a bioethanol burner this size gives background warmth and nothing more.',
      'Een vrijstaande stalen haard van 54 cm hoog met een tank van 0,9 liter die ongeveer 3 u 20 per vulling meegaat, en een roestvrijstalen dooflid om de vlam te doven in plaats van af te wachten. De fabrikant noemt 15 tot 20 m²: lees dat als sfeer, niet als verwarmingsvermogen — een bio-ethanolbrander van dit formaat geeft achtergrondwarmte en niets meer.',
      'Un hogar de pie de 54 cm de alto, en acero, con un depósito de 0,9 litros que dura unas 3 h 20 por llenado y una tapa apagallamas de acero inoxidable para apagar la llama sin esperar. El fabricante habla de 15 a 20 m²: tómelo como una indicación de ambiente, no como una potencia de calefacción — un quemador de bioetanol de este tamaño aporta un calor de apoyo, nada más.',
    ),
    bullets: {
      fr: [
        'Réservoir de 0,9 L — environ 3 h 20 de combustion',
        'Couvercle étouffoir en acier inoxydable fourni',
        'Dimensions 54 × 38 × 22 cm, finition noire',
        'Surface annoncée par le fabricant : 15 à 20 m²',
        'Chaleur d’appoint seulement — ne remplace pas un poêle',
      ],
      en: [
        '0.9 L tank — about 3 h 20 of burn time',
        'Stainless steel snuffer lid included',
        'Dimensions 54 × 38 × 22 cm, black finish',
        'Area claimed by the manufacturer: 15 to 20 m²',
        'Background warmth only — no substitute for a stove',
      ],
      nl: [
        'Tank van 0,9 L — ongeveer 3 u 20 brandtijd',
        'Roestvrijstalen dooflid meegeleverd',
        'Afmetingen 54 × 38 × 22 cm, zwarte afwerking',
        'Door de fabrikant opgegeven oppervlak: 15 tot 20 m²',
        'Alleen achtergrondwarmte — geen vervanging voor een kachel',
      ],
      es: [
        'Depósito de 0,9 L — unas 3 h 20 de combustión',
        'Tapa apagallamas de acero inoxidable incluida',
        'Dimensiones 54 × 38 × 22 cm, acabado negro',
        'Superficie indicada por el fabricante: 15 a 20 m²',
        'Solo calor de apoyo — no sustituye a una estufa',
      ],
    },
    specs: [
      ETHANOL_FUEL,
      { label: SPEC.mounting, value: L(
        'Sur pied',
        'Freestanding',
        'Vrijstaand',
        'De pie',
      ) },
      { label: SPEC.burnerCapacity, value: U('0,9 L') },
      { label: SPEC.autonomy, value: L(
        'Environ 3 h 20',
        'About 3 h 20',
        'Ongeveer 3 u 20',
        'Unas 3 h 20',
      ) },
      { label: SPEC.areaClaimed, value: U('15 – 20 m²') },
      { label: SPEC.dimensions, value: U('54 × 38 × 22 cm') },
      { label: SPEC.material, value: L(
        'Acier, étouffoir inox',
        'Steel, stainless snuffer',
        'Staal, rvs dooflid',
        'Acero, apagallamas inox',
      ) },
      VENTILATION_REQUIRED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'bioethanol-floor',
        L(
          'Foyer bioéthanol sur pied noir avec réservoir et étouffoir',
          'Black freestanding bioethanol hearth with tank and snuffer',
          'Zwarte vrijstaande bio-ethanolhaard met tank en dooflid',
          'Hogar de bioetanol de pie negro con depósito y apagallamas',
        ),
      ),
    ],
    variants: [],
    crossSell: ['bio-etna-table', 'bio-mauna-loa'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (6.5 kg emballé) — à peser avant la première expédition.
    weightGrams: 6_500,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 5,
  },
  // Relevé : https://www.manomano.es/p/biochimenea-de-suelo-kekai-mauna-loa-40x40x145-cm-con-quemador-de-acero-inoxidable-y-extintor-manual-color-blanco-76349090
  // Prix observé 67,80 €.
  {
    id: 'bio-mauna-loa',
    slug: {
      fr: 'kekai-mauna-loa-colonne-bioethanol-145-cm',
      en: 'kekai-mauna-loa-bioethanol-column-145-cm',
      nl: 'kekai-mauna-loa-bio-ethanolzuil-145-cm',
      es: 'kekai-mauna-loa-columna-de-bioetanol-145-cm',
    },
    name: 'KEKAI Mauna Loa',
    category: 'bioethanol',
    distribution: null,
    price: euros(69.9),
    compareAtPrice: null,
    tagline: L(
      'Une colonne de 1,45 m qui tient debout seule dans un angle.',
      'A 1.45 m column that stands on its own in a corner.',
      'Een zuil van 1,45 m die zelfstandig in een hoek staat.',
      'Una columna de 1,45 m que se sostiene sola en un rincón.',
    ),
    description: L(
      'Une colonne blanche de 1,45 m de haut sur une base carrée de 40 cm, avec brûleur en acier inoxydable et étouffoir manuel. Son intérêt est sa hauteur : la flamme arrive au niveau du regard et non au niveau du sol, ce qui change tout dans une pièce où l’on est debout ou assis sur un canapé. Comme tous les foyers de ce rayon, il ne demande ni conduit ni prise, et reste un objet décoratif.',
      'A white column 1.45 m tall on a 40 cm square base, with a stainless steel burner and a manual snuffer. Its point is the height: the flame sits at eye level rather than at floor level, which changes everything in a room where you stand or sit on a sofa. Like every hearth in this section it needs neither flue nor socket, and remains a decorative object.',
      'Een witte zuil van 1,45 m hoog op een vierkante voet van 40 cm, met roestvrijstalen brander en handmatig dooflid. Het punt is de hoogte: de vlam zit op ooghoogte in plaats van op vloerniveau, wat alles verandert in een kamer waar je staat of op een bank zit. Zoals elke haard in dit assortiment vraagt hij geen rookkanaal en geen stopcontact, en blijft hij een decoratief object.',
      'Una columna blanca de 1,45 m de alto sobre una base cuadrada de 40 cm, con quemador de acero inoxidable y apagallamas manual. Su interés es la altura: la llama queda a la altura de la vista y no del suelo, lo que cambia todo en una habitación donde se está de pie o sentado en un sofá. Como todos los hogares de esta sección, no necesita conducto ni enchufe, y sigue siendo un objeto decorativo.',
    ),
    bullets: {
      fr: [
        'Colonne de 145 cm, base de 40 × 40 cm',
        'Brûleur en acier inoxydable, étouffoir manuel fourni',
        'Finition blanche',
        'Ni conduit, ni prise électrique, ni raccordement',
        'Objet décoratif — ne remplace pas un appareil de chauffage',
      ],
      en: [
        '145 cm column, 40 × 40 cm base',
        'Stainless steel burner, manual snuffer included',
        'White finish',
        'No flue, no socket, no connection',
        'Decorative object — not a replacement for a heating appliance',
      ],
      nl: [
        'Zuil van 145 cm, voet van 40 × 40 cm',
        'Roestvrijstalen brander, handmatig dooflid meegeleverd',
        'Witte afwerking',
        'Geen rookkanaal, geen stopcontact, geen aansluiting',
        'Decoratief object — vervangt geen verwarmingstoestel',
      ],
      es: [
        'Columna de 145 cm, base de 40 × 40 cm',
        'Quemador de acero inoxidable, apagallamas manual incluido',
        'Acabado blanco',
        'Sin conducto, sin enchufe, sin conexión',
        'Objeto decorativo — no sustituye a un aparato de calefacción',
      ],
    },
    specs: [
      ETHANOL_FUEL,
      { label: SPEC.mounting, value: L(
        'Sur pied',
        'Freestanding',
        'Vrijstaand',
        'De pie',
      ) },
      { label: SPEC.dimensions, value: U('145 × 40 × 40 cm') },
      { label: SPEC.material, value: L(
        'Acier laqué blanc, brûleur inox',
        'White lacquered steel, stainless burner',
        'Wit gelakt staal, rvs-brander',
        'Acero lacado blanco, quemador inox',
      ) },
      VENTILATION_REQUIRED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'bioethanol-floor',
        L(
          'Colonne bioéthanol blanche de 145 cm avec brûleur inox',
          'White 145 cm bioethanol column with stainless burner',
          'Witte bio-ethanolzuil van 145 cm met rvs-brander',
          'Columna de bioetanol blanca de 145 cm con quemador inox',
        ),
      ),
    ],
    variants: [],
    crossSell: ['bio-homcom-floor', 'bio-siena-wall'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (11.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 11_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 6,
  },
  // Relevé : https://www.manomano.es/p/qlima-chimenea-de-etanol-cuadrada-42x23x42-cm-ffb-4242-6193566
  // Prix observé 187,35 €.
  // QLIMA est une marque européenne établie (groupe PVG) : c’est la seule du rayon dont
  // on peut raisonnablement attendre une notice et une déclaration de conformité en quatre langues.
  {
    id: 'bio-qlima-ffb4242',
    slug: {
      fr: 'qlima-ffb-4242-cheminee-bioethanol-carree',
      en: 'qlima-ffb-4242-square-bioethanol-fireplace',
      nl: 'qlima-ffb-4242-vierkante-bio-ethanolhaard',
      es: 'qlima-ffb-4242-chimenea-de-etanol-cuadrada',
    },
    name: 'QLIMA FFB 4242',
    category: 'bioethanol',
    distribution: null,
    price: euros(189.9),
    compareAtPrice: null,
    tagline: L(
      'Le format carré d’une marque qui fournit une vraie notice.',
      'The square format, from a brand that ships a real manual.',
      'Het vierkante formaat, van een merk dat een echte handleiding levert.',
      'El formato cuadrado de una marca que entrega un manual de verdad.',
    ),
    description: L(
      'Un foyer carré de 42 cm de côté, à poser, de la marque néerlandaise QLIMA. On le retient moins pour sa fiche que pour ce qui l’accompagne : un fabricant identifié, une référence de modèle stable (FFB 4242) et une notice, ce qui est loin d’être la règle sur ce rayon où beaucoup d’articles sont vendus sans marque. Pour un produit à flamme nue et combustible liquide, c’est l’argument le plus sérieux.',
      'A square 42 cm free-standing hearth from the Dutch brand QLIMA. The reason to pick it is less the spec sheet than what comes with it: a named manufacturer, a stable model reference (FFB 4242) and a manual — far from the norm in a category where many items are sold unbranded. For a product with an open flame and liquid fuel, that is the most serious argument there is.',
      'Een vierkante haard van 42 cm, los te plaatsen, van het Nederlandse merk QLIMA. De reden om hem te kiezen is minder het gegevensblad dan wat erbij hoort: een bekende fabrikant, een vast modelnummer (FFB 4242) en een handleiding — lang niet de regel in een categorie waar veel artikelen zonder merk worden verkocht. Voor een product met open vlam en vloeibare brandstof is dat het serieuste argument.',
      'Un hogar cuadrado de 42 cm de lado, para colocar, de la marca neerlandesa QLIMA. Se elige menos por su ficha que por lo que lo acompaña: un fabricante identificado, una referencia de modelo estable (FFB 4242) y un manual, lo que está lejos de ser la norma en una sección donde muchos artículos se venden sin marca. Para un producto de llama abierta y combustible líquido, es el argumento más serio.',
    ),
    bullets: {
      fr: [
        'Marque identifiée, référence de modèle stable : FFB 4242',
        'Format carré 42 × 23 × 42 cm, à poser',
        'Fabricant européen — notice et pièces disponibles',
        'Ni conduit, ni prise électrique',
        'Objet décoratif — ne remplace pas un appareil de chauffage',
      ],
      en: [
        'Named brand, stable model reference: FFB 4242',
        'Square 42 × 23 × 42 cm, free-standing',
        'European manufacturer — manual and parts available',
        'No flue, no mains socket',
        'Decorative object — not a replacement for a heating appliance',
      ],
      nl: [
        'Bekend merk, vast modelnummer: FFB 4242',
        'Vierkant 42 × 23 × 42 cm, los te plaatsen',
        'Europese fabrikant — handleiding en onderdelen beschikbaar',
        'Geen rookkanaal, geen stopcontact',
        'Decoratief object — vervangt geen verwarmingstoestel',
      ],
      es: [
        'Marca identificada, referencia de modelo estable: FFB 4242',
        'Formato cuadrado 42 × 23 × 42 cm, para colocar',
        'Fabricante europeo — manual y piezas disponibles',
        'Sin conducto, sin enchufe',
        'Objeto decorativo — no sustituye a un aparato de calefacción',
      ],
    },
    specs: [
      ETHANOL_FUEL,
      { label: SPEC.reference, value: U('FFB 4242') },
      { label: SPEC.mounting, value: L(
        'Posable',
        'Free-standing',
        'Los te plaatsen',
        'Para colocar',
      ) },
      { label: SPEC.dimensions, value: U('42 × 42 × 23 cm') },
      VENTILATION_REQUIRED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'bioethanol-table',
        L(
          'Foyer bioéthanol carré QLIMA posé au sol',
          'Square QLIMA bioethanol hearth standing on the floor',
          'Vierkante QLIMA bio-ethanolhaard op de vloer',
          'Hogar de bioetanol cuadrado QLIMA colocado en el suelo',
        ),
      ),
    ],
    variants: [],
    crossSell: ['bio-siena-wall', 'bio-revello'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (9.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 9_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 7,
  },
  // Relevé : https://www.manomano.es/p/siena-chimenea-de-bioetanol-pared-90x12xh40-cm-85700571
  // Prix observé 245,99 €.
  {
    id: 'bio-siena-wall',
    slug: {
      fr: 'frankystar-siena-cheminee-bioethanol-murale-90-cm',
      en: 'frankystar-siena-wall-bioethanol-fireplace-90-cm',
      nl: 'frankystar-siena-bio-ethanolhaard-wand-90-cm',
      es: 'frankystar-siena-chimenea-de-bioetanol-pared-90-cm',
    },
    name: 'FRANKYSTAR Siena',
    category: 'bioethanol',
    distribution: null,
    price: euros(249.9),
    compareAtPrice: null,
    tagline: L(
      'Un bandeau de flamme de 90 cm fixé au mur, 12 cm d’épaisseur.',
      'A 90 cm band of flame on the wall, 12 cm deep.',
      'Een vlammenband van 90 cm aan de wand, 12 cm diep.',
      'Una banda de llama de 90 cm fijada a la pared, 12 cm de grosor.',
    ),
    description: L(
      'Le format qui fait l’intérêt du bioéthanol : 90 cm de large pour seulement 12 cm d’épaisseur, fixé au mur comme un tableau. Aucun conduit à percer, aucune arrivée de gaz, aucune prise — c’est la seule technologie qui permet une vraie flamme dans un appartement où rien n’était prévu. En échange, la contrepartie est entière : la flamme consomme l’oxygène de la pièce et rejette du CO₂ et de la vapeur d’eau, donc la pièce doit être ventilée.',
      'This is the format that makes bioethanol worth it: 90 cm wide and only 12 cm deep, wall-mounted like a picture. No flue to cut, no gas supply, no socket — it is the only technology that puts a real flame in a flat where nothing was provided for. The trade-off is real: the flame consumes the room’s oxygen and releases CO₂ and water vapour, so the room has to be ventilated.',
      'Dit is het formaat dat bio-ethanol de moeite waard maakt: 90 cm breed en maar 12 cm diep, aan de wand als een schilderij. Geen rookkanaal te maken, geen gasleiding, geen stopcontact — het is de enige techniek die een echte vlam in een appartement brengt waar niets voorzien was. De keerzijde is reëel: de vlam verbruikt de zuurstof in de kamer en geeft CO₂ en waterdamp af, dus de kamer moet geventileerd zijn.',
      'Este es el formato que hace interesante el bioetanol: 90 cm de ancho por solo 12 cm de grosor, fijado a la pared como un cuadro. Sin conducto que perforar, sin acometida de gas, sin enchufe — es la única tecnología que permite una llama real en un piso donde nada estaba previsto. A cambio, la contrapartida es entera: la llama consume el oxígeno de la habitación y libera CO₂ y vapor de agua, por lo que la habitación debe estar ventilada.',
    ),
    bullets: {
      fr: [
        '90 cm de large, 12 cm d’épaisseur seulement — fixation murale',
        'Aucun percement de conduit, aucune arrivée de gaz',
        'Hauteur 40 cm',
        'La pièce doit rester ventilée pendant le fonctionnement',
        'Objet décoratif — ne remplace pas un appareil de chauffage',
      ],
      en: [
        '90 cm wide, only 12 cm deep — wall-mounted',
        'No flue to cut, no gas supply',
        'Height 40 cm',
        'The room must stay ventilated while it burns',
        'Decorative object — not a replacement for a heating appliance',
      ],
      nl: [
        '90 cm breed, slechts 12 cm diep — wandmontage',
        'Geen rookkanaal te maken, geen gasleiding',
        'Hoogte 40 cm',
        'De kamer moet geventileerd blijven tijdens gebruik',
        'Decoratief object — vervangt geen verwarmingstoestel',
      ],
      es: [
        '90 cm de ancho, solo 12 cm de grosor — fijación a la pared',
        'Sin perforar conducto, sin acometida de gas',
        'Altura 40 cm',
        'La habitación debe permanecer ventilada durante el uso',
        'Objeto decorativo — no sustituye a un aparato de calefacción',
      ],
    },
    specs: [
      ETHANOL_FUEL,
      { label: SPEC.mounting, value: L(
        'Murale',
        'Wall-mounted',
        'Wandmontage',
        'A la pared',
      ) },
      { label: SPEC.dimensions, value: U('40 × 90 × 12 cm') },
      VENTILATION_REQUIRED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'bioethanol-wall',
        L(
          'Foyer bioéthanol murale de 90 cm, bandeau de flamme',
          '90 cm wall-mounted bioethanol hearth with a band of flame',
          'Bio-ethanolhaard van 90 cm aan de wand met vlammenband',
          'Hogar de bioetanol de pared de 90 cm con banda de llama',
        ),
      ),
    ],
    variants: [],
    crossSell: ['bio-revello', 'bio-qlima-ffb4242'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (14.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 14_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 8,
  },
  // Relevé : https://www.manomano.es/p/chimenea-de-bioetanol-revello-capacidad-125-l-superficie-calefactable-30-potencia-kw-3-120x15x40h-cm-negro-148-91705849
  // Prix observé 669,99 €.
  // Le vendeur annonce 3 kW et 30 m². Ces deux nombres sont repris TELS QUELS, en
  // texte libre, et non dans un bloc technique : ils ne viennent pas d’un essai
  // normalisé et ne se comparent pas à la puissance d’un poêle.
  {
    id: 'bio-revello',
    slug: {
      fr: 'dmora-revello-cheminee-bioethanol-120-cm',
      en: 'dmora-revello-bioethanol-fireplace-120-cm',
      nl: 'dmora-revello-bio-ethanolhaard-120-cm',
      es: 'dmora-revello-chimenea-de-bioetanol-120-cm',
    },
    name: 'DMORA Revello',
    category: 'bioethanol',
    distribution: null,
    price: euros(679.9),
    compareAtPrice: null,
    tagline: L(
      '1,20 m de large et un brûleur de 1,25 litre : le haut du rayon.',
      '1.20 m wide with a 1.25 litre burner: the top of the range.',
      '1,20 m breed met een brander van 1,25 liter: de top van het assortiment.',
      '1,20 m de ancho y un quemador de 1,25 litros: lo más alto de la gama.',
    ),
    description: L(
      'Le modèle le plus large du rayon : 120 cm de façade, 40 cm de haut, 15 cm d’épaisseur, et un brûleur de 1,25 litre — presque le double des petits formats, donc une autonomie plus longue entre deux remplissages. Le fabricant annonce 3 kW et 30 m² ; nous reprenons ces chiffres tels qu’il les donne, sans les traduire en surface chauffée, parce qu’un brûleur à bioéthanol n’est pas mesuré comme un poêle. Fabrication italienne.',
      'The widest model in the range: a 120 cm front, 40 cm tall, 15 cm deep, and a 1.25 litre burner — nearly twice the small formats, so a longer run between refills. The maker quotes 3 kW and 30 m²; we pass those figures on as given, without turning them into a heated area, because a bioethanol burner is not measured like a stove. Made in Italy.',
      'Het breedste model van het assortiment: een front van 120 cm, 40 cm hoog, 15 cm diep, en een brander van 1,25 liter — bijna het dubbele van de kleine formaten, dus langer branden tussen twee vullingen. De fabrikant noemt 3 kW en 30 m²; wij geven die cijfers door zoals hij ze opgeeft, zonder ze als verwarmd oppervlak te presenteren, want een bio-ethanolbrander wordt niet gemeten als een kachel. Italiaans fabricaat.',
      'El modelo más ancho de la sección: 120 cm de frente, 40 cm de alto, 15 cm de grosor y un quemador de 1,25 litros — casi el doble de los formatos pequeños, por tanto más autonomía entre dos llenados. El fabricante indica 3 kW y 30 m²; reproducimos esas cifras tal como las da, sin traducirlas a superficie calentada, porque un quemador de bioetanol no se mide como una estufa. Fabricación italiana.',
    ),
    bullets: {
      fr: [
        'Façade de 120 cm — le plus large du rayon',
        'Brûleur de 1,25 L : moins de remplissages',
        'Dimensions 40 × 120 × 15 cm',
        'Annoncé par le fabricant : 3 kW, 30 m²',
        'Fabrication italienne',
      ],
      en: [
        '120 cm front — the widest in the range',
        '1.25 L burner: fewer refills',
        'Dimensions 40 × 120 × 15 cm',
        'Quoted by the manufacturer: 3 kW, 30 m²',
        'Made in Italy',
      ],
      nl: [
        'Front van 120 cm — het breedste van het assortiment',
        'Brander van 1,25 L: minder bijvullen',
        'Afmetingen 40 × 120 × 15 cm',
        'Opgegeven door de fabrikant: 3 kW, 30 m²',
        'Italiaans fabricaat',
      ],
      es: [
        'Frente de 120 cm — el más ancho de la sección',
        'Quemador de 1,25 L: menos llenados',
        'Dimensiones 40 × 120 × 15 cm',
        'Indicado por el fabricante: 3 kW, 30 m²',
        'Fabricación italiana',
      ],
    },
    specs: [
      ETHANOL_FUEL,
      { label: SPEC.mounting, value: L(
        'Murale ou encastrée',
        'Wall-mounted or recessed',
        'Wand of inbouw',
        'A la pared o empotrada',
      ) },
      { label: SPEC.burnerCapacity, value: U('1,25 L') },
      { label: SPEC.areaClaimed, value: U('30 m²') },
      { label: SPEC.power, value: L(
        '3 kW annoncés par le fabricant',
        '3 kW quoted by the manufacturer',
        '3 kW opgegeven door de fabrikant',
        '3 kW indicados por el fabricante',
      ) },
      { label: SPEC.dimensions, value: U('40 × 120 × 15 cm') },
      VENTILATION_REQUIRED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'bioethanol-wall-wide',
        L(
          'Foyer bioéthanol de 120 cm à deux brûleurs, finition noire',
          '120 cm bioethanol hearth with two burners, black finish',
          'Bio-ethanolhaard van 120 cm met twee branders, zwarte afwerking',
          'Hogar de bioetanol de 120 cm con dos quemadores, acabado negro',
        ),
      ),
    ],
    variants: [],
    crossSell: ['bio-siena-wall', 'elec-oregon'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (26.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 26_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 4,
    dispatchDaysMax: 10,
  },
  // Relevé : https://www.manomano.es/p/chimenea-elctrica-1600-w-kekai-minesota-84x26x53-cm-con-simulacin-de-fuego-para-paredmesa-negra-42574205
  // Prix observé 127,68 €.
  {
    id: 'elec-minesota',
    slug: {
      fr: 'kekai-minesota-cheminee-electrique-1600-w',
      en: 'kekai-minesota-electric-fireplace-1600-w',
      nl: 'kekai-minesota-elektrische-haard-1600-w',
      es: 'kekai-minesota-chimenea-electrica-1600-w',
    },
    name: 'KEKAI Minesota',
    category: 'electricfire',
    distribution: null,
    price: euros(129.9),
    compareAtPrice: null,
    tagline: L(
      'Au mur ou sur un meuble, 1 600 W sur une prise ordinaire.',
      'On the wall or on a sideboard, 1,600 W from an ordinary socket.',
      'Aan de wand of op een kast, 1.600 W uit een gewoon stopcontact.',
      'En la pared o sobre un mueble, 1.600 W en un enchufe normal.',
    ),
    description: L(
      'Le point d’entrée du rayon électrique, et le plus souple à installer : 84 cm de large, 26 cm de profondeur, à fixer au mur ou simplement à poser sur un meuble. Il se branche sur une prise 230 V et délivre 1 600 W, soit un vrai appoint pour une pièce de vie — c’est la différence avec le bioéthanol, qui ne chauffe presque pas. En contrepartie, la flamme est une simulation lumineuse, pas une combustion.',
      'The entry point of the electric section, and the easiest to install: 84 cm wide, 26 cm deep, to fix to the wall or simply stand on a sideboard. It plugs into a 230 V socket and delivers 1,600 W, which is genuine supplementary heat for a living room — the difference from bioethanol, which barely heats at all. In exchange, the flame is a lit simulation, not combustion.',
      'Het instappunt van het elektrische assortiment, en het makkelijkst te plaatsen: 84 cm breed, 26 cm diep, aan de wand te bevestigen of gewoon op een kast te zetten. Hij gaat in een 230 V-stopcontact en levert 1.600 W, echte bijverwarming voor een woonkamer — het verschil met bio-ethanol, dat nauwelijks verwarmt. Daartegenover staat dat de vlam een lichtsimulatie is, geen verbranding.',
      'El punto de entrada de la sección eléctrica, y el más flexible de instalar: 84 cm de ancho, 26 cm de profundidad, para fijar a la pared o simplemente colocar sobre un mueble. Se enchufa a 230 V y entrega 1.600 W, un apoyo real para una sala de estar — la diferencia con el bioetanol, que apenas calienta. En cambio, la llama es una simulación luminosa, no una combustión.',
    ),
    bullets: {
      fr: [
        '1 600 W sur une prise 230 V ordinaire',
        'Pose murale ou sur un meuble, au choix',
        'Dimensions 53 × 84 × 26 cm, finition noire',
        'Flamme simulée par éclairage — aucune combustion',
        'Ni conduit, ni combustible, ni entretien',
      ],
      en: [
        '1,600 W from an ordinary 230 V socket',
        'Wall-mounted or free-standing on furniture, your choice',
        'Dimensions 53 × 84 × 26 cm, black finish',
        'Flame simulated by lighting — no combustion',
        'No flue, no fuel, no maintenance',
      ],
      nl: [
        '1.600 W uit een gewoon 230 V-stopcontact',
        'Wandmontage of op een meubel, naar keuze',
        'Afmetingen 53 × 84 × 26 cm, zwarte afwerking',
        'Vlam gesimuleerd met licht — geen verbranding',
        'Geen rookkanaal, geen brandstof, geen onderhoud',
      ],
      es: [
        '1.600 W en un enchufe de 230 V normal',
        'Instalación a la pared o sobre un mueble, a elegir',
        'Dimensiones 53 × 84 × 26 cm, acabado negro',
        'Llama simulada por iluminación — sin combustión',
        'Sin conducto, sin combustible, sin mantenimiento',
      ],
    },
    specs: [
      { label: SPEC.electricPower, value: U('1 600 W') },
      ELECTRIC_SUPPLY,
      { label: SPEC.mounting, value: L(
        'Murale ou posable',
        'Wall-mounted or free-standing',
        'Wand of vrijstaand',
        'A la pared o de sobremesa',
      ) },
      { label: SPEC.dimensions, value: U('53 × 84 × 26 cm') },
      FLAME_SIMULATED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'electric-wall',
        L(
          'Foyer électrique mural noir de 84 cm, flamme simulée',
          'Black 84 cm wall-mounted electric hearth with simulated flame',
          'Zwarte elektrische wandhaard van 84 cm met gesimuleerde vlam',
          'Hogar eléctrico de pared negro de 84 cm con llama simulada',
        ),
      ),
    ],
    variants: [],
    crossSell: ['elec-homcom-wall', 'elec-oregon'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (10.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 10_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 5,
  },
  // Relevé : https://www.manomano.es/p/homcom-chimenea-electrica-tipo-estufa-de-pared-1000w-2000w-885x135x56cm-negro-2937096
  // Prix observé 161,99 €.
  {
    id: 'elec-homcom-wall',
    slug: {
      fr: 'homcom-cheminee-electrique-murale-1000-2000-w',
      en: 'homcom-wall-electric-fireplace-1000-2000-w',
      nl: 'homcom-elektrische-wandhaard-1000-2000-w',
      es: 'homcom-chimenea-electrica-pared-1000-2000-w',
    },
    name: 'HOMCOM 820-234V90',
    category: 'electricfire',
    distribution: null,
    price: euros(169.9),
    compareAtPrice: null,
    tagline: L(
      'Deux allures, 1 000 ou 2 000 W, et 13,5 cm d’épaisseur.',
      'Two settings, 1,000 or 2,000 W, and 13.5 cm deep.',
      'Twee standen, 1.000 of 2.000 W, en 13,5 cm diep.',
      'Dos niveles, 1.000 o 2.000 W, y 13,5 cm de grosor.',
    ),
    description: L(
      'Un panneau mural de 88,5 cm pour 13,5 cm d’épaisseur, avec deux allures de chauffe : 1 000 W en demi-puissance, 2 000 W en pleine puissance. C’est le réglage qui compte à l’usage — 2 000 W pour monter la température d’une pièce froide, 1 000 W pour la tenir ensuite sans surchauffer. L’effet de flamme fonctionne indépendamment du chauffage, donc on peut garder l’ambiance en été sans chauffer.',
      'An 88.5 cm wall panel just 13.5 cm deep, with two heat settings: 1,000 W at half power, 2,000 W at full. That setting is what matters in daily use — 2,000 W to bring a cold room up, 1,000 W to hold it afterwards without overheating. The flame effect runs independently of the heater, so you can keep the ambience in summer without the heat.',
      'Een wandpaneel van 88,5 cm en slechts 13,5 cm diep, met twee verwarmingsstanden: 1.000 W op halve kracht, 2.000 W op volle kracht. Die instelling is wat in de praktijk telt — 2.000 W om een koude kamer op te warmen, 1.000 W om hem daarna op peil te houden zonder te overdrijven. Het vlameffect werkt los van de verwarming, dus je houdt de sfeer in de zomer zonder warmte.',
      'Un panel de pared de 88,5 cm con solo 13,5 cm de grosor y dos niveles de calor: 1.000 W a media potencia, 2.000 W a plena potencia. Ese ajuste es lo que cuenta en el uso diario — 2.000 W para subir la temperatura de una habitación fría, 1.000 W para mantenerla después sin sobrecalentar. El efecto de llama funciona de forma independiente de la calefacción, así que se puede conservar el ambiente en verano sin calentar.',
    ),
    bullets: {
      fr: [
        'Deux allures : 1 000 W et 2 000 W',
        'Effet de flamme utilisable sans chauffage',
        'Panneau mural de 88,5 cm, 13,5 cm d’épaisseur',
        'Hauteur 56 cm, finition noire',
        'Ni conduit, ni combustible, ni entretien',
      ],
      en: [
        'Two settings: 1,000 W and 2,000 W',
        'Flame effect usable with the heater off',
        '88.5 cm wall panel, 13.5 cm deep',
        'Height 56 cm, black finish',
        'No flue, no fuel, no maintenance',
      ],
      nl: [
        'Twee standen: 1.000 W en 2.000 W',
        'Vlameffect ook te gebruiken zonder verwarming',
        'Wandpaneel van 88,5 cm, 13,5 cm diep',
        'Hoogte 56 cm, zwarte afwerking',
        'Geen rookkanaal, geen brandstof, geen onderhoud',
      ],
      es: [
        'Dos niveles: 1.000 W y 2.000 W',
        'Efecto de llama utilizable sin calefacción',
        'Panel de pared de 88,5 cm, 13,5 cm de grosor',
        'Altura 56 cm, acabado negro',
        'Sin conducto, sin combustible, sin mantenimiento',
      ],
    },
    specs: [
      { label: SPEC.electricPower, value: U('1 000 / 2 000 W') },
      ELECTRIC_SUPPLY,
      { label: SPEC.heatSettings, value: L(
        'Deux allures',
        'Two settings',
        'Twee standen',
        'Dos niveles',
      ) },
      { label: SPEC.mounting, value: L(
        'Murale',
        'Wall-mounted',
        'Wandmontage',
        'A la pared',
      ) },
      { label: SPEC.dimensions, value: U('56 × 88,5 × 13,5 cm') },
      FLAME_SIMULATED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'electric-wall-wide',
        L(
          'Panneau de cheminée électrique murale noir de 88,5 cm',
          'Black 88.5 cm wall-mounted electric fireplace panel',
          'Zwart elektrisch wandhaardpaneel van 88,5 cm',
          'Panel de chimenea eléctrica de pared negro de 88,5 cm',
        ),
      ),
    ],
    variants: [],
    crossSell: ['elec-minesota', 'elec-pzcc-121'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (12.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 12_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 5,
  },
  // Relevé : https://www.manomano.es/p/chimenea-electrica-pared-1800w-600x158x520mm-9408180
  // Prix observé 179,95 €.
  {
    id: 'elec-mercatools',
    slug: {
      fr: 'mercatools-mt-1800-cheminee-electrique-murale',
      en: 'mercatools-mt-1800-wall-electric-fireplace',
      nl: 'mercatools-mt-1800-elektrische-wandhaard',
      es: 'mercatools-mt-1800-chimenea-electrica-pared',
    },
    name: 'MERCATOOLS MT 1800',
    category: 'electricfire',
    distribution: null,
    price: euros(184.9),
    compareAtPrice: null,
    tagline: L(
      'Le format compact : 60 cm de large, 1 800 W.',
      'The compact format: 60 cm wide, 1,800 W.',
      'Het compacte formaat: 60 cm breed, 1.800 W.',
      'El formato compacto: 60 cm de ancho, 1.800 W.',
    ),
    description: L(
      'Le plus étroit des foyers électriques du rayon : 60 cm de large seulement, pour 1 800 W. C’est le modèle à retenir quand le mur disponible est court — une chambre, un couloir, un bureau — là où un panneau de 1,20 m ne tiendrait pas. La puissance, elle, ne descend pas avec la largeur : 1 800 W suffisent à chauffer une petite pièce en appoint.',
      'The narrowest electric hearth in the range: just 60 cm wide for 1,800 W. This is the one to pick when the available wall is short — a bedroom, a hallway, a study — where a 1.20 m panel would not fit. The output does not shrink with the width: 1,800 W is enough to warm a small room as supplementary heat.',
      'De smalste elektrische haard van het assortiment: slechts 60 cm breed voor 1.800 W. Dit is de keuze wanneer de beschikbare wand kort is — een slaapkamer, een gang, een werkkamer — waar een paneel van 1,20 m niet past. Het vermogen krimpt niet mee met de breedte: 1.800 W is genoeg om een kleine kamer bij te verwarmen.',
      'El más estrecho de los hogares eléctricos de la sección: solo 60 cm de ancho para 1.800 W. Es el modelo a elegir cuando la pared disponible es corta — un dormitorio, un pasillo, un despacho — donde un panel de 1,20 m no cabría. La potencia no baja con el ancho: 1.800 W bastan para calentar una habitación pequeña como apoyo.',
    ),
    bullets: {
      fr: [
        '60 cm de large seulement — pour les murs courts',
        '1 800 W sur une prise 230 V',
        'Dimensions 52 × 60 × 15,8 cm',
        'Pose murale',
        'Ni conduit, ni combustible, ni entretien',
      ],
      en: [
        'Only 60 cm wide — for short walls',
        '1,800 W from a 230 V socket',
        'Dimensions 52 × 60 × 15.8 cm',
        'Wall-mounted',
        'No flue, no fuel, no maintenance',
      ],
      nl: [
        'Slechts 60 cm breed — voor korte wanden',
        '1.800 W uit een 230 V-stopcontact',
        'Afmetingen 52 × 60 × 15,8 cm',
        'Wandmontage',
        'Geen rookkanaal, geen brandstof, geen onderhoud',
      ],
      es: [
        'Solo 60 cm de ancho — para paredes cortas',
        '1.800 W en un enchufe de 230 V',
        'Dimensiones 52 × 60 × 15,8 cm',
        'Instalación a la pared',
        'Sin conducto, sin combustible, sin mantenimiento',
      ],
    },
    specs: [
      { label: SPEC.electricPower, value: U('1 800 W') },
      ELECTRIC_SUPPLY,
      { label: SPEC.mounting, value: L(
        'Murale',
        'Wall-mounted',
        'Wandmontage',
        'A la pared',
      ) },
      { label: SPEC.dimensions, value: U('52 × 60 × 15,8 cm') },
      FLAME_SIMULATED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'electric-wall',
        L(
          'Cheminée électrique murale compacte de 60 cm',
          'Compact 60 cm wall-mounted electric fireplace',
          'Compacte elektrische wandhaard van 60 cm',
          'Chimenea eléctrica de pared compacta de 60 cm',
        ),
      ),
    ],
    variants: [],
    crossSell: ['elec-minesota', 'elec-orbegozo-cm8000'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (11.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 11_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 3,
    dispatchDaysMax: 6,
  },
  // Relevé : https://www.manomano.es/p/orbegozo-cm-8000-negro-estufa-electrica-1800w-efecto-fuego-41188108
  // Prix observé 199,90 €.
  // ORBEGOZO est un fabricant espagnol de petit électroménager : réseau de service
  // après-vente et pièces détachées existants, ce qui n’est pas le cas de la plupart
  // des références de ce rayon.
  {
    id: 'elec-orbegozo-cm8000',
    slug: {
      fr: 'orbegozo-cm-8000-poele-electrique-effet-feu',
      en: 'orbegozo-cm-8000-electric-stove-fire-effect',
      nl: 'orbegozo-cm-8000-elektrische-kachel-vuureffect',
      es: 'orbegozo-cm-8000-estufa-electrica-efecto-fuego',
    },
    name: 'ORBEGOZO CM 8000',
    category: 'electricfire',
    distribution: null,
    price: euros(199.9),
    compareAtPrice: null,
    tagline: L(
      'Une marque espagnole avec un vrai service après-vente.',
      'A Spanish brand with a real after-sales network.',
      'Een Spaans merk met een echt servicenetwerk.',
      'Una marca española con un servicio posventa real.',
    ),
    description: L(
      'Un poêle électrique à effet de feu de 1 800 W, posable, de la marque espagnole ORBEGOZO. Ce qui le distingue n’est pas sa fiche — proche de celle des modèles sans marque — mais le fabricant : ORBEGOZO fait du petit électroménager depuis des décennies et dispose d’un réseau de pièces détachées. Sur un appareil chauffant qu’on garde dix ans, c’est ce qui fait la différence entre une réparation et une poubelle.',
      'A 1,800 W free-standing electric fire-effect stove from the Spanish brand ORBEGOZO. What sets it apart is not the spec sheet — close to that of unbranded models — but the manufacturer: ORBEGOZO has made small domestic appliances for decades and has a spare-parts network. On a heater you keep for ten years, that is the difference between a repair and a bin.',
      'Een vrijstaande elektrische kachel met vuureffect van 1.800 W van het Spaanse merk ORBEGOZO. Wat hem onderscheidt is niet het gegevensblad — vergelijkbaar met dat van merkloze modellen — maar de fabrikant: ORBEGOZO maakt al decennia klein huishoudelijk apparatuur en heeft een onderdelennetwerk. Bij een verwarmingstoestel dat je tien jaar houdt, is dat het verschil tussen reparatie en de vuilnisbak.',
      'Una estufa eléctrica de efecto fuego de 1.800 W, para colocar, de la marca española ORBEGOZO. Lo que la distingue no es su ficha — parecida a la de los modelos sin marca — sino el fabricante: ORBEGOZO fabrica pequeño electrodoméstico desde décadas y dispone de una red de recambios. En un aparato de calor que se conserva diez años, eso marca la diferencia entre una reparación y la basura.',
    ),
    bullets: {
      fr: [
        '1 800 W, effet de feu',
        'Fabricant espagnol — pièces détachées disponibles',
        'Référence de modèle stable : CM 8000',
        'Posable, finition noire',
        'Ni conduit, ni combustible, ni entretien',
      ],
      en: [
        '1,800 W, fire effect',
        'Spanish manufacturer — spare parts available',
        'Stable model reference: CM 8000',
        'Free-standing, black finish',
        'No flue, no fuel, no maintenance',
      ],
      nl: [
        '1.800 W, vuureffect',
        'Spaanse fabrikant — onderdelen beschikbaar',
        'Vast modelnummer: CM 8000',
        'Vrijstaand, zwarte afwerking',
        'Geen rookkanaal, geen brandstof, geen onderhoud',
      ],
      es: [
        '1.800 W, efecto fuego',
        'Fabricante español — recambios disponibles',
        'Referencia de modelo estable: CM 8000',
        'Para colocar, acabado negro',
        'Sin conducto, sin combustible, sin mantenimiento',
      ],
    },
    specs: [
      { label: SPEC.electricPower, value: U('1 800 W') },
      ELECTRIC_SUPPLY,
      { label: SPEC.reference, value: U('CM 8000') },
      { label: SPEC.mounting, value: L(
        'Posable',
        'Free-standing',
        'Vrijstaand',
        'Para colocar',
      ) },
      FLAME_SIMULATED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'electric-floor',
        L(
          'Poêle électrique noir à effet de feu posé au sol',
          'Black free-standing electric stove with fire effect',
          'Zwarte vrijstaande elektrische kachel met vuureffect',
          'Estufa eléctrica negra de efecto fuego colocada en el suelo',
        ),
      ),
    ],
    variants: [],
    crossSell: ['elec-mercatools', 'elec-pzcc-121'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (9.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 9_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 2,
    dispatchDaysMax: 6,
  },
  // Relevé : https://www.manomano.es/p/chimenea-electrica-de-1000w2000w-chimenea-decorativa-de-imitacion-de-chimenea-efecto-llama-con-5-niveles-de-brillo-ajustables-121x25x77cm-blanca-207910261
  // Prix observé 332,89 €.
  {
    id: 'elec-pzcc-121',
    slug: {
      fr: 'pzcc-121-cheminee-electrique-encastrable-blanche',
      en: 'pzcc-121-built-in-electric-fireplace-white',
      nl: 'pzcc-121-inbouw-elektrische-haard-wit',
      es: 'pzcc-121-chimenea-electrica-empotrable-blanca',
    },
    name: 'PZCC 121 Blanca',
    category: 'electricfire',
    distribution: null,
    price: euros(339.9),
    compareAtPrice: null,
    tagline: L(
      'Cinq niveaux de flamme, deux allures, et un vrai volume de foyer.',
      'Five flame levels, two heat settings, and a real hearth volume.',
      'Vijf vlamniveaus, twee standen en een echt haardvolume.',
      'Cinco niveles de llama, dos niveles de calor y un volumen de hogar real.',
    ),
    description: L(
      'Un foyer blanc de 121 cm de large et 77 cm de haut, assez profond — 25 cm — pour donner l’illusion d’un vrai âtre, et non d’un écran posé contre un mur. C’est le seul du rayon à offrir ce volume. Deux allures de chauffe, 1 000 et 2 000 W, et cinq niveaux de luminosité pour la flamme, réglables indépendamment du chauffage.',
      'A white hearth 121 cm wide and 77 cm tall, deep enough at 25 cm to read as a real firebox rather than a screen propped against a wall. It is the only one in the range with that volume. Two heat settings, 1,000 and 2,000 W, and five flame brightness levels, adjustable independently of the heat.',
      'Een witte haard van 121 cm breed en 77 cm hoog, met 25 cm diep genoeg om als een echte vuurkorf te lezen en niet als een scherm tegen een wand. Hij is de enige in het assortiment met dat volume. Twee verwarmingsstanden, 1.000 en 2.000 W, en vijf helderheidsniveaus voor de vlam, los van de verwarming te regelen.',
      'Un hogar blanco de 121 cm de ancho y 77 cm de alto, bastante profundo — 25 cm — para dar la ilusión de un hogar real, y no de una pantalla apoyada en la pared. Es el único de la sección con ese volumen. Dos niveles de calor, 1.000 y 2.000 W, y cinco niveles de brillo para la llama, ajustables de forma independiente de la calefacción.',
    ),
    bullets: {
      fr: [
        'Le plus profond du rayon : 25 cm, un vrai volume de foyer',
        'Deux allures : 1 000 W et 2 000 W',
        'Cinq niveaux de luminosité de flamme',
        'Dimensions 77 × 121 × 25 cm',
        'Ni conduit, ni combustible, ni entretien',
      ],
      en: [
        'The deepest in the range: 25 cm, a real hearth volume',
        'Two settings: 1,000 W and 2,000 W',
        'Five flame brightness levels',
        'Dimensions 77 × 121 × 25 cm',
        'No flue, no fuel, no maintenance',
      ],
      nl: [
        'De diepste van het assortiment: 25 cm, een echt haardvolume',
        'Twee standen: 1.000 W en 2.000 W',
        'Vijf helderheidsniveaus voor de vlam',
        'Afmetingen 77 × 121 × 25 cm',
        'Geen rookkanaal, geen brandstof, geen onderhoud',
      ],
      es: [
        'El más profundo de la sección: 25 cm, un volumen de hogar real',
        'Dos niveles: 1.000 W y 2.000 W',
        'Cinco niveles de brillo de llama',
        'Dimensiones 77 × 121 × 25 cm',
        'Sin conducto, sin combustible, sin mantenimiento',
      ],
    },
    specs: [
      { label: SPEC.electricPower, value: U('1 000 / 2 000 W') },
      ELECTRIC_SUPPLY,
      { label: SPEC.control, value: L(
        'Cinq niveaux de luminosité de flamme',
        'Five flame brightness levels',
        'Vijf helderheidsniveaus voor de vlam',
        'Cinco niveles de brillo de llama',
      ) },
      { label: SPEC.mounting, value: L(
        'Encastrable ou posable',
        'Built-in or free-standing',
        'Inbouw of vrijstaand',
        'Empotrable o para colocar',
      ) },
      { label: SPEC.dimensions, value: U('77 × 121 × 25 cm') },
      FLAME_SIMULATED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'electric-floor',
        L(
          'Foyer électrique encastrable blanc de 121 cm de large',
          'White 121 cm wide built-in electric hearth',
          'Witte inbouw elektrische haard van 121 cm breed',
          'Hogar eléctrico empotrable blanco de 121 cm de ancho',
        ),
      ),
    ],
    variants: [],
    crossSell: ['elec-oregon', 'elec-homcom-wall'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (24.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 24_000,
    freight: false,
    badge: null,
    dispatchDaysMin: 4,
    dispatchDaysMax: 9,
  },
  // Relevé : https://www.manomano.es/p/chimenea-elctrica-2000-w-kekai-oregon-127x16x48-cm-con-simulacin-de-fuego-para-pared-negra-42574204
  // Prix observé 406,85 €.
  {
    id: 'elec-oregon',
    slug: {
      fr: 'kekai-oregon-cheminee-electrique-murale-127-cm',
      en: 'kekai-oregon-wall-electric-fireplace-127-cm',
      nl: 'kekai-oregon-elektrische-wandhaard-127-cm',
      es: 'kekai-oregon-chimenea-electrica-pared-127-cm',
    },
    name: 'KEKAI Oregon',
    category: 'electricfire',
    distribution: null,
    price: euros(409.9),
    compareAtPrice: null,
    tagline: L(
      '1,27 m de large pour 16 cm d’épaisseur, et 2 000 W.',
      '1.27 m wide, 16 cm deep, and 2,000 W.',
      '1,27 m breed, 16 cm diep, en 2.000 W.',
      '1,27 m de ancho por 16 cm de grosor, y 2.000 W.',
    ),
    description: L(
      'Le grand format du rayon, et le plus difficile à obtenir autrement : 1,27 m de bandeau lumineux pour seulement 16 cm d’épaisseur, en 2 000 W. Cette largeur-là change la pièce — un foyer de 60 cm se regarde, un foyer de 1,27 m structure un mur. Et comme il ne demande qu’une prise, il s’installe dans un salon où aucun conduit n’existe, ce qu’aucun poêle ne permet.',
      'The large format of the range, and the hardest to get any other way: a 1.27 m band of light just 16 cm deep, at 2,000 W. That width changes the room — a 60 cm hearth is something you look at, a 1.27 m hearth organises a wall. And since it needs nothing but a socket, it goes into a living room with no flue at all, which no stove can do.',
      'Het grote formaat van het assortiment, en het moeilijkst op een andere manier te krijgen: een lichtband van 1,27 m en slechts 16 cm diep, bij 2.000 W. Die breedte verandert de kamer — een haard van 60 cm bekijk je, een haard van 1,27 m organiseert een wand. En omdat hij alleen een stopcontact nodig heeft, past hij in een woonkamer zonder rookkanaal, wat geen enkele kachel kan.',
      'El gran formato de la sección, y el más difícil de conseguir de otro modo: 1,27 m de banda luminosa con solo 16 cm de grosor, a 2.000 W. Ese ancho cambia la habitación — un hogar de 60 cm se mira, un hogar de 1,27 m estructura una pared. Y como solo necesita un enchufe, se instala en un salón sin ningún conducto, algo que ninguna estufa permite.',
    ),
    bullets: {
      fr: [
        '1,27 m de large — le plus grand format du rayon',
        '16 cm d’épaisseur seulement, pose murale',
        '2 000 W sur une prise 230 V',
        'Dimensions 48 × 127 × 16 cm, finition noire',
        'Ni conduit, ni combustible, ni entretien',
      ],
      en: [
        '1.27 m wide — the largest format in the range',
        'Only 16 cm deep, wall-mounted',
        '2,000 W from a 230 V socket',
        'Dimensions 48 × 127 × 16 cm, black finish',
        'No flue, no fuel, no maintenance',
      ],
      nl: [
        '1,27 m breed — het grootste formaat van het assortiment',
        'Slechts 16 cm diep, wandmontage',
        '2.000 W uit een 230 V-stopcontact',
        'Afmetingen 48 × 127 × 16 cm, zwarte afwerking',
        'Geen rookkanaal, geen brandstof, geen onderhoud',
      ],
      es: [
        '1,27 m de ancho — el formato más grande de la sección',
        'Solo 16 cm de grosor, instalación a la pared',
        '2.000 W en un enchufe de 230 V',
        'Dimensiones 48 × 127 × 16 cm, acabado negro',
        'Sin conducto, sin combustible, sin mantenimiento',
      ],
    },
    specs: [
      { label: SPEC.electricPower, value: U('2 000 W') },
      ELECTRIC_SUPPLY,
      { label: SPEC.mounting, value: L(
        'Murale',
        'Wall-mounted',
        'Wandmontage',
        'A la pared',
      ) },
      { label: SPEC.dimensions, value: U('48 × 127 × 16 cm') },
      FLAME_SIMULATED,
      WARRANTY_2Y,
    ],
    tech: null,
    images: [
      placeholderImage(
        'electric-wall-wide',
        L(
          'Cheminée électrique murale noire de 127 cm de large',
          'Black 127 cm wide wall-mounted electric fireplace',
          'Zwarte elektrische wandhaard van 127 cm breed',
          'Chimenea eléctrica de pared negra de 127 cm de ancho',
        ),
      ),
    ],
    variants: [],
    crossSell: ['elec-pzcc-121', 'bio-revello'],
    hero: false,
    dataVerified: false,
    // Poids ESTIMÉ (18.0 kg emballé) — à peser avant la première expédition.
    weightGrams: 18_000,
    freight: false,
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
