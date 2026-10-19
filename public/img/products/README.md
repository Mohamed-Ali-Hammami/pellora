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

## Formats

`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.svg`.

Format recommandé : **1600 × 1600 px**, fond clair uni, appareil centré. Les
cartes produit affichent un carré, la fiche produit affiche le visuel en 4/5.

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
