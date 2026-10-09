/**
 * Catalogue public — SOURCE DE VERITE unique du site.
 *
 * Ce module est importable cote client : il ne doit donc contenir AUCUNE
 * donnée sensible (prix d’achat, référence fournisseur, marge). Celles-ci
 * vivent dans `sourcing.ts`, qui ne doit jamais être importe par un
 * composant client. Le test `tests/leakage.test.ts` vérifié cette frontière.
 *
 * Changer de niche = reecrire ce fichier et `sourcing.ts`. Rien d’autre.
 */

import { euros } from './money';
import type { Product } from './catalog.types';

export const products: readonly Product[] = [
  {
    id: 'kit-rituel',
    slug: 'kit-rituel-complet',
    name: 'Kit Rituel Complet',
    category: 'kit',
    price: euros(89),
    compareAtPrice: euros(112),
    tagline: 'Tout ce qu’il faut pour réussir une tasse, et rien de plus.',
    description:
      "Le kit rassemble les quatre objets qui changent vraiment le résultat dans la tasse : le dripper conique en céramique, la verseuse graduée, la balance au décigramme et le filtre inox permanent. Nous l’avons compose en retirant tout ce qui ne sert qu’une fois. Si vous démarrez l’infusion manuelle, c’est le point d’entrée le plus direct ; si vous infusez déjà, c’est le remplacement complet d’un matériel dépareillé.",
    bullets: [
      'Dripper conique céramique — extraction régulière, nettoyage immédiat',
      'Verseuse borosilicate 600 ml graduée à 200 / 400 / 600',
      'Balance 0,1 g avec minuteur intégré',
      'Filtre inox permanent — plus de filtres papier à racheter',
      'Livret de 6 recettes imprimées, dosages en grammes',
    ],
    specs: [
      { label: 'Contenu', value: '4 pièces + livret' },
      { label: 'Capacité', value: '600 ml (2 à 4 tasses)' },
      { label: 'Matières', value: 'Céramique, verre borosilicate, inox 304' },
      { label: 'Lave-vaisselle', value: 'Oui, sauf balance' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [
      { src: '/img/kit-rituel-1.svg', alt: 'Kit Rituel Complet : dripper, verseuse, balance et filtre inox' },
      { src: '/img/kit-rituel-2.svg', alt: 'Le dripper du Kit Rituel pose sur la verseuse graduée' },
    ],
    variants: [],
    crossSell: ['moulin-precision', 'bouilloire-col-cygne', 'carnet-degustation'],
    hero: true,
    weightGrams: 1850,
    bundleOf: ['dripper-ceramique', 'verseuse-600', 'balance-precision', 'filtre-inox'],
    badge: 'Le plus vendu',
  },
  {
    id: 'kit-rituel-moulin',
    slug: 'kit-rituel-et-moulin',
    name: 'Kit Rituel + Moulin',
    category: 'kit',
    price: euros(149),
    compareAtPrice: euros(168),
    tagline: 'Le kit complet, plus la seule pièce qui compte autant que l’eau.',
    description:
      "Moudre juste avant l’infusion est le changement le plus audible sur une tasse — davantage que le choix du dripper. Ce lot ajoute donc le moulin manuel à meules coniques au Kit Rituel. C’est la configuration que nous utilisons nous-mêmes au quotidien, et celle que nous recommandons si vous ne voulez acheter qu’une fois.",
    bullets: [
      'Le Kit Rituel Complet dans son intégralité',
      'Moulin manuel à meules coniques inox, 38 crans de réglage',
      'Du filtre au cold brew sans changer de matériel',
      '19 € d’économie par rapport aux deux achetés séparément',
    ],
    specs: [
      { label: 'Contenu', value: '5 pièces + livret' },
      { label: 'Meules', value: 'Coniques inox, 38 crans' },
      { label: 'Capacité moulin', value: '30 g de grains' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [
      { src: '/img/kit-rituel-moulin-1.svg', alt: 'Kit Rituel Complet accompagne du moulin manuel' },
    ],
    variants: [],
    crossSell: ['bouilloire-col-cygne', 'carnet-degustation'],
    hero: true,
    weightGrams: 2550,
    bundleOf: ['kit-rituel', 'moulin-precision'],
    badge: 'Meilleur rapport',
  },
  {
    id: 'moulin-precision',
    slug: 'moulin-manuel-precision',
    name: 'Moulin manuel Précision',
    category: 'mouture',
    price: euros(79),
    compareAtPrice: null,
    tagline: 'Des meules coniques, pas des lames.',
    description:
      "Un moulin à lames hache le grain en morceaux de tailles inégales : les fines sur-extraient et amérisent pendant que les grosses restent acides. Des meules coniques découpent à dimension constante. C’est toute la différence entre une tasse confuse et une tasse lisible. 38 crans couvrent l’espresso comme la French press.",
    bullets: [
      'Meules coniques en inox — granulométrie régulière',
      '38 crans, de l’espresso au cold brew',
      'Axe sur roulement : pas de jeu latéral, pas de fines parasites',
      'Corps aluminium anodise, environ 60 s pour 20 g',
      'Aucune électronique : rien qui puisse tomber en panne',
    ],
    specs: [
      { label: 'Meules', value: 'Coniques, inox trempé 420' },
      { label: 'Réglages', value: '38 crans, pas de 22 microns' },
      { label: 'Capacité', value: '30 g' },
      { label: 'Poids', value: '620 g' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [
      { src: '/img/moulin-1.svg', alt: 'Moulin manuel Précision, corps aluminium et manivelle' },
    ],
    variants: [
      { id: 'noir', label: 'Noir mat', priceDelta: 0 },
      { id: 'inox', label: 'Inox brosse', priceDelta: euros(6) },
    ],
    crossSell: ['kit-rituel', 'carnet-degustation'],
    hero: true,
    weightGrams: 780,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'bouilloire-col-cygne',
    slug: 'bouilloire-col-de-cygne',
    name: 'Bouilloire col de cygne',
    category: 'extraction',
    price: euros(49),
    compareAtPrice: null,
    tagline: 'Un filet d’eau que vous dirigez au millimètre.',
    description:
      "Le bec effile transforme le versement en geste contrôlable : vous mouillez la mouture par cercles réguliers au lieu de la creuser. Modèle à poser sur plaque ou gaz, sans électronique — donc rien à brancher, rien à réparer. Le manche reste froid grâce à l’entretoise creuse.",
    bullets: [
      'Bec col de cygne — débit lent et dirigeable',
      'Inox 304 brosse, compatible induction, gaz et vitrocéramique',
      'Manche à entretoise creuse : reste manipulable à chaud',
      'Capacité utile 900 ml',
      'Non électrique : pas de carte, pas de panne',
    ],
    specs: [
      { label: 'Capacité', value: '900 ml utiles (1,2 L total)' },
      { label: 'Matière', value: 'Inox 304' },
      { label: 'Compatibilité', value: 'Induction, gaz, vitrocéramique, électrique' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [
      { src: '/img/bouilloire-1.svg', alt: 'Bouilloire en inox à bec col de cygne' },
    ],
    variants: [],
    crossSell: ['kit-rituel', 'dripper-ceramique'],
    hero: false,
    weightGrams: 980,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'dripper-ceramique',
    slug: 'dripper-ceramique',
    name: 'Dripper céramique',
    category: 'extraction',
    price: euros(29),
    compareAtPrice: null,
    tagline: 'La céramique garde la chaleur, le verre la perd.',
    description:
      "Cône à 60 degrés et rainures hélicoïdales : l’eau descend par le centre au lieu de longer la paroi, ce qui évite les chemins préférentiels. La céramique emmagasine la chaleur du préchauffage et limite la chute de température pendant l’infusion — c’est la raison principale de la préférer au plastique.",
    bullets: [
      'Cône 60° à rainures hélicoïdales',
      'Céramique émaillée — inertie thermique élevée',
      'Compatible filtres papier n°02 et filtre inox permanent',
      'Se pose sur la plupart des mugs et carafes',
    ],
    specs: [
      { label: 'Taille', value: 'n°02 (1 à 4 tasses)' },
      { label: 'Matière', value: 'Céramique émaillée' },
      { label: 'Lave-vaisselle', value: 'Oui' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [{ src: '/img/dripper-1.svg', alt: 'Dripper conique en céramique émaillée' }],
    variants: [
      { id: 'blanc', label: 'Blanc craie', priceDelta: 0 },
      { id: 'argile', label: 'Argile', priceDelta: 0 },
    ],
    crossSell: ['verseuse-600', 'filtre-inox'],
    hero: false,
    weightGrams: 420,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'verseuse-600',
    slug: 'verseuse-600-ml',
    name: 'Verseuse 600 ml',
    category: 'extraction',
    price: euros(34),
    compareAtPrice: null,
    tagline: 'Graduée là où vous regardez vraiment.',
    description:
      "Verre borosilicate soufflé, gradué à 200, 400 et 600 ml — les trois volumes qui correspondent à une, deux et quatre tasses. Les repères sont sérigraphies et résistent au lave-vaisselle. Le col large accepte tous nos drippers.",
    bullets: [
      'Borosilicate — résiste au choc thermique',
      'Graduations 200 / 400 / 600 ml sérigraphiées',
      'Col large compatible dripper n°02',
      'Bec verseur net, sans goutte',
    ],
    specs: [
      { label: 'Capacité', value: '600 ml' },
      { label: 'Matière', value: 'Verre borosilicate' },
      { label: 'Lave-vaisselle', value: 'Oui' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [{ src: '/img/verseuse-1.svg', alt: 'Verseuse en verre borosilicate graduée, 600 ml' }],
    variants: [],
    crossSell: ['dripper-ceramique', 'filtre-inox'],
    hero: false,
    weightGrams: 480,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'balance-precision',
    slug: 'balance-precision',
    name: 'Balance Précision 0,1 g',
    category: 'precision',
    price: euros(39),
    compareAtPrice: null,
    tagline: 'Le café se dose en grammes, pas en cuillères.',
    description:
      "Une cuillère à soupe de grains pèse entre 5 et 9 g selon la torréfaction : c’est assez pour rendre une recette irréproductible. La balance affiche le décigramme et intégré un minuteur, les deux informations dont vous avez besoin en même temps. Surface plane, nettoyage d’un coup d’éponge.",
    bullets: [
      'Précision 0,1 g jusqu’a 3 kg',
      'Minuteur intégré, affichage simultané poids + temps',
      'Fonction tare, arrêt automatique désactivable',
      'Surface plane et joints affleurants — se nettoie vraiment',
      'Alimentation 2 piles AAA (fournies)',
    ],
    specs: [
      { label: 'Portée', value: '3 kg' },
      { label: 'Précision', value: '0,1 g' },
      { label: 'Alimentation', value: '2 x AAA (fournies)' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [{ src: '/img/balance-1.svg', alt: 'Balance de précision avec minuteur intégré' }],
    variants: [],
    crossSell: ['kit-rituel', 'moulin-precision'],
    hero: false,
    weightGrams: 520,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'french-press',
    slug: 'french-press-350-ml',
    name: 'French Press 350 ml',
    category: 'extraction',
    price: euros(32),
    compareAtPrice: null,
    tagline: 'Une tasse pleine, sans filtre à jeter.',
    description:
      "L’infusion par immersion donne un corps plus épais que le filtre : moins de clarté aromatique, plus de matière. Le format 350 ml correspond à une grande tasse — le bon volume quand on infuse pour soi. Le piston à double tamis limite nettement les fines dans la tasse.",
    bullets: [
      'Double tamis inox — moins de dépôt dans la tasse',
      'Verre borosilicate remplaçable séparément',
      '350 ml : une grande tasse, pas une carafe',
      'Aucun consommable',
    ],
    specs: [
      { label: 'Capacité', value: '350 ml' },
      { label: 'Matières', value: 'Borosilicate + inox 304' },
      { label: 'Lave-vaisselle', value: 'Oui' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [{ src: '/img/french-press-1.svg', alt: 'French press en verre de 350 ml' }],
    variants: [],
    crossSell: ['moulin-precision', 'carnet-degustation'],
    hero: false,
    weightGrams: 610,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'kit-voyage',
    slug: 'kit-voyage',
    name: 'Kit Voyage',
    category: 'kit',
    price: euros(54),
    compareAtPrice: euros(61),
    tagline: 'Le même café, en chambre d’hôtel.',
    description:
      "Dripper pliable en inox, mug double paroi 350 ml et pochette en toile cotonnière. Plie, l’ensemble tient dans la poche latérale d’un sac cabine. Pas de pièce fragile, pas de verre : c’est le seul critère qui compte quand on déplace son matériel.",
    bullets: [
      'Dripper inox pliable — 8 mm à plat',
      'Mug double paroi 350 ml, garde chaud environ 2 h',
      'Pochette toile avec rabat à pression',
      'Aucune pièce en verre',
    ],
    specs: [
      { label: 'Contenu', value: 'Dripper pliable, mug 350 ml, pochette' },
      { label: 'Poids total', value: '480 g' },
      { label: 'Matières', value: 'Inox 304, toile coton' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [{ src: '/img/kit-voyage-1.svg', alt: 'Kit Voyage : dripper pliable, mug isotherme et pochette' }],
    variants: [],
    crossSell: ['moulin-precision', 'carnet-degustation'],
    hero: false,
    weightGrams: 560,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'filtre-inox',
    slug: 'filtre-inox-reutilisable',
    name: 'Filtre inox réutilisable',
    category: 'accessoire',
    price: euros(16),
    compareAtPrice: null,
    tagline: 'Le dernier filtre que vous achetez.',
    description:
      "Maille inox électroformée à 150 microns. Le papier retient une partie des huiles ; l’inox les laisse passer, ce qui donne une tasse plus ronde et un peu plus trouble. À rincer après usage, à passer au lave-vaisselle une fois par semaine.",
    bullets: [
      'Maille électroformée 150 microns',
      'Compatible dripper conique n°02',
      'Zéro consommable, zéro déchet',
      'Lave-vaisselle',
    ],
    specs: [
      { label: 'Compatibilité', value: 'Dripper conique n°02' },
      { label: 'Maille', value: '150 microns' },
      { label: 'Matière', value: 'Inox 304' },
      { label: 'Garantie', value: '2 ans (garantie légale de conformité)' },
    ],
    images: [{ src: '/img/filtre-1.svg', alt: 'Filtre à café permanent en maille inox' }],
    variants: [],
    crossSell: ['dripper-ceramique', 'verseuse-600'],
    hero: false,
    weightGrams: 90,
    bundleOf: [],
    badge: null,
  },
  {
    id: 'carnet-degustation',
    slug: 'carnet-de-degustation',
    name: 'Carnet de dégustation',
    category: 'accessoire',
    price: euros(14),
    compareAtPrice: null,
    tagline: 'Parce qu’on oublie toujours le réglage qui marchait.',
    description:
      "60 fiches pré-imprimées : origine, torréfaction, dose, mouture, température, temps, puis trois lignes pour ce que vous avez senti. En trois semaines vous saurez quel réglage donne votre tasse, au lieu de recommencer à chaque paquet. Papier 120 g, reliure cousue qui tient ouvert à plat.",
    bullets: [
      '60 fiches de dégustation pré-imprimées',
      'Roue des arômes en rabat intérieur',
      'Papier 120 g, reliure cousue à plat',
      'Format 14 x 19 cm',
    ],
    specs: [
      { label: 'Pages', value: '60 fiches + roue des arômes' },
      { label: 'Format', value: '14 x 19 cm' },
      { label: 'Papier', value: '120 g, reliure cousue' },
    ],
    images: [{ src: '/img/carnet-1.svg', alt: 'Carnet de dégustation ouvert sur une fiche' }],
    variants: [],
    crossSell: ['kit-rituel', 'moulin-precision'],
    hero: false,
    weightGrams: 180,
    bundleOf: [],
    badge: null,
  },
] as const;

const bySlug = new Map(products.map((p) => [p.slug, p]));
const byId = new Map(products.map((p) => [p.id, p]));

export function getProductBySlug(slug: string): Product | undefined {
  return bySlug.get(slug);
}

export function getProductById(id: string): Product | undefined {
  return byId.get(id);
}

export function getHeroProducts(): readonly Product[] {
  return products.filter((p) => p.hero);
}

export function getVariant(product: Product, variantId: string | null) {
  if (variantId === null) return null;
  return product.variants.find((v) => v.id === variantId) ?? null;
}

/**
 * Prix unitaire effectif TTC pour un couple produit/variante.
 * C’est la SEULE fonction autorisée à déterminer un prix : le serveur la
 * rappelle à la validation du panier pour ne jamais faire confiance au client.
 */
export function unitPrice(product: Product, variantId: string | null): number {
  const variant = getVariant(product, variantId);
  return product.price + (variant?.priceDelta ?? 0);
}

export const categoryLabels: Record<string, string> = {
  kit: 'Kits',
  extraction: 'Extraction',
  mouture: 'Mouture',
  precision: 'Précision',
  accessoire: 'Accessoires',
};
