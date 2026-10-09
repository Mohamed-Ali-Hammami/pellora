/**
 * Contenu éditorial.
 *
 * Ce n’est pas de la décoration : le trafic organique est le seul levier qui
 * fasse baisser durablement le coût d’acquisition. Une boutique qui ne vit que
 * de publicité payante voit sa marge entièrement captée par la plateforme
 * publicitaire dès que les enchères montent.
 *
 * Les paramètres d’infusion donnes ici sont ceux couramment admis en café de
 * spécialité (ratio 1:16 à 1:17, eau à 92-96 °C). Ils sont présentes comme
 * notre pratique, pas comme une vérité absolue : le goût final dépend du
 * grain, de la torréfaction et de l’eau.
 */

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  readingMinutes: number;
  updated: string;
  intro: string;
  sections: GuideSection[];
  relatedProducts: string[];
}

export const guides: readonly Guide[] = [
  {
    slug: 'reussir-son-cafe-filtre',
    title: 'Réussir son café filtre : la méthode en six points',
    description:
      'Ratio, température, mouture, pré-infusion, temps total : les six variables qui déterminent une tasse, et comment les régler.',
    readingMinutes: 9,
    updated: '9 octobre 2026',
    intro:
      "Un café rate n’est presque jamais un problème de grain. C’est un problème de variable non contrôlée : un dosage à la cuillère, une eau bouillante, une mouture faite la veille. Voici les six réglages qui comptent, dans l’ordre de leur influence.",
    sections: [
      {
        heading: '1. Le ratio : pesez, ne devinez pas',
        paragraphs: [
          "C’est le réglage le plus déterminant, et le plus facile à rater. Une cuillère à soupe de grains pèse entre 5 et 9 g selon la torréfaction et la densité du grain : deux cafés dosés « à la cuillère » peuvent différer de 40 % en concentration.",
          "Nous travaillons entre 1:16 et 1:17 — soit 60 à 63 g de café par litre d’eau. Pour une verseuse de 500 ml, cela donne 30 g de café. Commencez à 1:16, notez, ajustez.",
        ],
        list: [
          'Trop amer, assèche la bouche : trop de café, ou mouture trop fine',
          'Acide, creux, finit vite : pas assez de café, ou mouture trop grossière',
        ],
      },
      {
        heading: '2. La mouture : juste avant, jamais avant',
        paragraphs: [
          "Les composes aromatiques du café sont volatils : une fois le grain ouvert, ils s’échappent en quelques minutes. Un café moulu là veille a perdu l’essentiel de ce qui le distinguait.",
          "Le type de moulin compte autant que le moment. Un moulin à lames hache le grain en morceaux inégaux : les fines sur-extraient et amérisent pendant que les gros morceaux restent acides, dans la même tasse. Des meules coniques découpent à dimension constante.",
          "Pour le filtre, visez une texture proche du sucre de canne : granuleuse sous le doigt, sans poudre.",
        ],
      },
      {
        heading: '3. La température : pas d’eau bouillante',
        paragraphs: [
          "De l’eau à 100 °C extrait trop vite les composés amers. Nous versons entre 92 et 96 °C. Sans thermomètre, il suffit de retirer la bouilloire du feu dès les premiers gros bouillons et d’attendre environ 45 secondes : l’eau redescend dans la bonne plage.",
          "Pour une torréfaction claire, restez haut dans la plage (95-96 °C) : le grain est plus dense et résiste à l’extraction. Pour une torréfaction foncée, descendez vers 90-92 °C.",
        ],
      },
      {
        heading: '4. La pré-infusion : trente secondes qui changent tout',
        paragraphs: [
          "Le café fraîchement moulu contient du dioxyde de carbone. Verse d’un coup, l’eau rencontre ce gaz, la mouture gonfle et se creuse : l’eau trouve alors des passages préférentiels et traverse sans extraire.",
          "Versez donc deux fois le poids du café en eau — 60 g d’eau pour 30 g de café — et attendez 30 à 45 secondes. La mouture gonfle, dégaze, puis retombe. Vous pouvez alors verser le reste.",
        ],
      },
      {
        heading: '5. Le versement : par cercles, depuis le centre',
        paragraphs: [
          "Un filet d’eau dirige est tout l’intérêt d’un bec col de cygne. Versez par cercles concentriques en partant du centre, sans jamais atteindre le papier : l’eau qui longe la paroi descend sans traverser la mouture.",
          "Procédez en deux ou trois versements plutôt qu’un seul, en laissant le niveau redescendre à mi-hauteur entre chaque. Le lit de café reste ainsi agite de façon homogène.",
        ],
      },
      {
        heading: '6. Le temps total : votre seul indicateur fiable',
        paragraphs: [
          "Pour 15 à 30 g de café en cône, l’écoulement complet doit prendre entre 2 min 30 et 3 min 30, pré-infusion comprise. C’est le chronomètre qui vous dit si votre mouture est juste — pas votre œil.",
          "Trop rapide (moins de 2 min) : affinez la mouture. Trop lent (plus de 4 min) : grossissez-la. Ne changez qu’une variable à la fois, sinon vous ne saurez pas laquelle a agi.",
        ],
      },
      {
        heading: 'Une recette pour commencer',
        paragraphs: [
          "Si vous ne voulez retenir qu’une chose, retenez celle-ci. Elle fonctionne avec à peu près tous les cafés de spécialité.",
        ],
        list: [
          '30 g de café moulu juste avant, texture sucre de canne',
          '500 g d’eau à 94 °C',
          'Pré-infusion : 60 g d’eau, attendre 40 secondes',
          'Versement en trois fois : jusqu’a 250 g, puis 375 g, puis 500 g',
          'Écoulement complet visé : 3 minutes',
        ],
      },
    ],
    relatedProducts: ['kit-rituel', 'moulin-precision', 'bouilloire-col-cygne'],
  },
  {
    slug: 'choisir-son-moulin-a-cafe',
    title: 'Lames ou meules : pourquoi votre moulin décide du résultat',
    description:
      'La différence entre un moulin à lames et un moulin à meules, ce qu’elle change dans la tasse, et combien il faut dépenser.',
    readingMinutes: 6,
    updated: '9 octobre 2026',
    intro:
      "Si vous ne devez améliorer qu’un seul élément de votre matériel, c’est le moulin — avant le dripper, avant la bouilloire. Voici pourquoi, et comment choisir sans surpayer.",
    sections: [
      {
        heading: 'Ce que fait un moulin à lames',
        paragraphs: [
          "Une lame tourne à grande vitesse et frappe le grain jusqu’a le réduire en morceaux. Le résultat est par construction irrégulier : de la poudre fine coexiste avec des fragments grossiers.",
          "Dans la tasse, ces deux populations s’extraient à des vitesses différentes. Les fines libèrent rapidement des composés amers et astringents, les gros morceaux n’ont pas le temps de céder leurs sucres. On obtient une tasse simultanément amère et acide — le défaut est souvent attribue au grain alors qu’il vient du moulin.",
        ],
      },
      {
        heading: 'Ce que font des meules',
        paragraphs: [
          "Deux surfaces, coniques ou plates, sont séparées d’un écart réglable. Le grain est entraîné entre elles et fragmente jusqu’a passer cet écart. La dimension de sortie est donc imposée par la géométrie, pas par le hasard.",
          "La conséquence pratique : une extraction homogène, donc une tasse lisible, où l’on reconnaît ce que le torréfacteur annonce.",
        ],
      },
      {
        heading: 'Manuel ou électrique',
        paragraphs: [
          "À budget égal, un moulin manuel offre de meilleures meules qu’un électrique : il n’y a ni moteur ni électronique à financer. Comptez environ 60 secondes pour 20 g — c’est le temps de la pré-infusion.",
          "L’électrique se justifie si vous moulez de grandes quantités ou plusieurs fois par jour. En dessous, le manuel est le meilleur rapport qualite-prix, et il n’a rien qui puisse tomber en panne.",
        ],
      },
      {
        heading: 'Combien dépenser',
        paragraphs: [
          "En dessous de 40 €, les meules sont généralement estampées et l’axe a du jeu : la régularité promise n’est pas tenue. Entre 60 et 90 €, on trouve des meules coniques en acier trempé sur roulement, ce qui suffit largement pour le filtre.",
          "Au-delà, on paie surtout la vitesse, la finesse pour l’espresso et la finition. Ce n’est pas nécessaire pour une tasse filtre réussie.",
        ],
        list: [
          'Meules coniques ou plates en acier, pas des lames',
          'Axe sur roulement, sans jeu latéral perceptible',
          'Réglage par crans repérables, pour revenir à un réglage connu',
          'Capacité d’au moins 25 g, soit une verseuse complète',
        ],
      },
    ],
    relatedProducts: ['moulin-precision', 'kit-rituel-moulin'],
  },
];

const bySlug = new Map(guides.map((g) => [g.slug, g]));

export function getGuide(slug: string): Guide | undefined {
  return bySlug.get(slug);
}
