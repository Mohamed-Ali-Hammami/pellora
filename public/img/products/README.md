# Photos produit

Déposez ici les visuels de chaque appareil, un dossier par produit, nommé
avec l'**identifiant du produit** tel qu'il figure dans `src/lib/catalog.ts` :

```
public/img/products/
├── aria-6/
│   ├── 01.jpg      ← visuel principal (le premier par ordre alphabétique)
│   ├── 02.jpg
│   └── 03.jpg
├── idro-15/
│   └── 01.webp
└── …
```

Puis lancez :

```bash
npm run media:scan
```

Le script régénère `src/lib/product-media.generated.ts` et le site sert
automatiquement les photos à la place des illustrations vectorielles. Aucune
autre modification de code n'est nécessaire.

## Identifiants disponibles

| Famille      | Identifiants                                                        |
| ------------ | ------------------------------------------------------------------- |
| Air ventilé  | `aria-6`, `aria-9-canal`, `vela-8-slim`, `aria-12-duo`              |
| Hydro        | `idro-12-compact`, `idro-15`, `idro-20-ecs`, `idro-24-plus`         |
| Accessoires  | `kit-conduit-80`, `thermostat-wifi`, `aspirateur-cendres`, `granules-palette` |
| Bioéthanol   | `bio-etna-table`, `bio-homcom-floor`, `bio-mauna-loa`, `bio-qlima-ffb4242`, `bio-siena-wall`, `bio-revello` |
| Électriques  | `elec-minesota`, `elec-homcom-wall`, `elec-mercatools`, `elec-orbegozo-cm8000`, `elec-pzcc-121`, `elec-oregon` |

Les poêles ETNA (`anna-12`, `vertigo-up`, `vulcano-silenzio-up`) ont déjà
leurs visuels.

## Récupérer les visuels d'un relevé

Pour les deux familles de foyers décoratifs, les URL des visuels sont
conservées dans `data/releves/*.json` (champ `imageSource`) :

```bash
npm run media:fetch          # les 12 fiches du catalogue
npm run media:fetch -- --all # les 86 références du relevé
npm run media:scan           # puis, pour les référencer
```

**Avertissement, et il n'est pas de forme.** Ces visuels appartiennent aux
vendeurs de la place de marché où le relevé a été fait, pas à nous. Les
télécharger pour travailler est une chose ; les publier sur la boutique
demande l'accord écrit du titulaire des droits — fabricant ou vendeur. Sans
cet accord, la facture rétroactive d'une agence dépasse largement le prix d'un
visuel acheté, ou d'une photo faite soi-même.

## Formats et résolution

`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.svg`.

**Toutes les tailles sont acceptées.** `npm run media:scan` mesure chaque
fichier et inscrit sa résolution dans `src/lib/product-media.generated.ts` ;
l'affichage s'y adapte et **n'agrandit jamais** une image au-delà de sa
résolution réelle :

- plus grande que son cadre → elle le remplit ;
- plus petite → elle s'affiche **à sa taille, nette, centrée** sur le fond du
  cadre, plutôt qu'étirée et molle.

En dessous de 600 px de côté, le script le **signale** sans rien écarter : une
vignette de 470 px n'occupera qu'une partie du cadre, et une de 125 px presque
rien. C'est une information, pas un refus — à vous de juger si le visuel vend
le produit.

Recommandé : **1600 × 1600 px**, fond clair uni, appareil centré. Les cartes
produit affichent un carré, la fiche produit affiche le visuel en 4/5.

### Récupérer le fichier d'origine

Sur un site fournisseur, un clic droit sur la photo donne souvent la vignette
et non l'original. Demandez le *media pack* par e-mail, ou ouvrez la photo en
grand format sur la fiche du fournisseur avant de l'enregistrer : l'adresse
d'une vignette contient fréquemment une mention de taille (`_125x125`,
`/thumb/`, `?w=125`) qu'il suffit de retirer pour obtenir l'original.

## Documents à demander avec les photos

Pour qu'une fiche soit complète et conforme, il faut, en plus des visuels :

| Document | Ce qu'il apporte |
| --- | --- |
| Étiquette énergétique | Classe et puissance nominale — valeurs opposables (règlement UE 2015/1186) |
| Fiche technique | Puissance mini/maxi, rendement, réservoir, sortie fumées, dimensions, poids, niveau sonore |
| Déclaration de performance | Exigée à la demande du client et pour les aides publiques |
| Référence commerciale exacte | Distingue deux modèles d'une même gamme |

**Deux modèles d'une même gamme ont deux étiquettes énergétiques
différentes.** Un simple changement de coloris, non : si la puissance de
l'étiquette change, c'est un autre modèle, et il lui faut sa propre fiche.

## Droits d'usage — à lire avant de déposer un fichier

N'utilisez que des visuels dont l'usage vous est **concédé** :

1. le *media pack* de votre fournisseur — c'est la voie normale en
   dropshipping, demandez-le explicitement par écrit ;
2. vos propres photographies ;
3. une banque d'images avec licence commerciale explicite.

Une photo récupérée via un moteur de recherche reste protégée par le droit
d'auteur, même sans mention de copyright. Sur un site marchand, le risque
n'est pas théorique : les agences pratiquent la facturation rétroactive, pour
des montants très supérieurs au prix d'un visuel sous licence.

## Mettre un document de côté

Un fichier dont le nom commence par un souligné est ignoré par
`npm run media:scan` : il reste auprès de son produit sans entrer dans la
galerie.

```
vulcano-silenzio-up/
  _etiquette-energie.webp   ← conservée, non publiée
```

C'est le cas d'une étiquette énergétique reçue avant les photographies :
seule exploitable, elle deviendrait l'image principale du produit et
s'afficherait à la place de l'appareil dans toutes les grilles. Le jour où les
photos arrivent, retirez le souligné, renumérotez et relancez le script.
