# Commandes de collecte

Tous les chemins sont relatifs à la racine du dépôt. Sous Windows, remplace
`python3` par `python`.

## 0. Vérifier que les outils tournent

```powershell
python tools/tests/test_scrape.py
python tools/tests/test_images.py
python tools/tests/test_collect.py
```

Trois fois « tout passe. » et tu peux y aller.

## 1. Un essai, sur 3 fiches

Avant de lancer 86 requêtes, vérifie que tu passes leur protection.

```powershell
python tools/collect.py --urls urls/manomano-catalogue-12.txt --rps 1 --dossier collect
```

Coupe au bout de 3 lignes avec Ctrl-C. Le journal garde ce qui est fait.
Regarde `collect/donnees.json` : si `titre`, `prix` et `images` sont remplis,
c'est bon.

**Si ça échoue, deux causes différentes :**

- **pages vides** (`titre : Chargement…`, pas de prix) → le contenu n'arrive
  qu'après le JavaScript. Ajoute `--navigateur` :

  ```powershell
  npm install playwright
  npx playwright install chromium

  python tools/browser.py "<une-url>"
  python tools/collect.py --urls urls/manomano-catalogue-12.txt --navigateur --rps 1 --dossier collect
  ```

- **403 systématique** → le site refuse le trafic automatisé. Baisse à
  `--rps 0.3`. Un navigateur piloté n'y changera rien : il s'annonce comme
  tel, et je ne le déguise pas. À ce stade, c'est le site qui dit non.

## 2. Les 12 fiches du catalogue — à faire en premier

```powershell
python tools/collect.py --urls urls/manomano-catalogue-12.txt --rps 1 --reprendre --dossier collect
```

C'est celle qui rapporte le plus : ces 12 fiches sont déjà dans le site, et
leurs **poids réels** remplaceront les estimations de `src/lib/sourcing.ts`.

## 3. Les 86 fiches relevées

```powershell
python tools/collect.py --urls urls/manomano-foyers-86.txt --rps 1 --concurrence 2 --reprendre --dossier collect
```

Compte environ 2 minutes à 1 req/s. `--reprendre` saute les 12 déjà faites.

## 4. Beaucoup plus de produits : moissonner les 24 pages de liste

Deux commandes, dans cet ordre. La première relève les URL produit des pages
de catégorie (9 pages bioéthanol + 15 électriques), la seconde les collecte.

```powershell
python tools/collect.py --urls urls/manomano-categories.txt --liens "/p/[a-z0-9-]+-[0-9]+$" --sortie-liens urls/moissonnees.txt --rps 1 --dossier collect

python tools/collect.py --urls urls/moissonnees.txt --rps 1 --concurrence 2 --reprendre --dossier collect
```

Leurs pages annoncent « +500 produits » par famille. La moisson te dira
combien elle a réellement trouvé.

## 5. Compléter les visuels manquants

```powershell
python tools/collect.py --urls urls/manomano-foyers-86.txt --images-manquantes --rps 1 --reprendre --dossier collect
```

Ou par mots-clés seuls, sur les 12 du catalogue :

```powershell
python tools/collect.py --requetes urls/requetes-catalogue-12.txt --rps 0.5 --min-image 800 --dossier collect
```

## 6. Verser les visuels dans le site

`collect/images/<sku>/` n'est pas lu par le site. Pour les 12 fiches du
catalogue, copie dans `public/img/products/<id-produit>/` puis :

```powershell
npm run media:scan
```

## Les réglages qui comptent

| Option | À quoi ça sert |
| ------ | -------------- |
| `--rps 1` | 1 requête par seconde **et par hôte**. Commence là. |
| `--burst 3` | avance au démarrage. Baisse à 1 si tu te fais freiner. |
| `--concurrence 2` | hôtes en parallèle. Sur un seul site, ça ne change rien : un seul appel à la fois par hôte, toujours. |
| `--reprendre` | saute ce qui est déjà au journal. **Mets-le toujours.** |
| `--max-images 8` | visuels par produit. |
| `--min-image 600` | écarte les vignettes. Mets 800 si tu veux de la qualité. |
| `--sans-images` | données seulement, beaucoup plus rapide. |

En fin de course, la ligne `DÉBIT TENU` dit par hôte combien de requêtes sont
parties et combien étaient autorisées — tu peux vérifier, pas juste espérer.

## Ce que ça produit

```
collect/
├── donnees.json        toutes les fiches consolidées
├── journal.jsonl       une ligne par résultat, dès qu'il arrive (reprise)
├── images/<sku>/       les visuels des pages produit
└── recherche/<mots>/   les visuels venant des moteurs de recherche
```

`collect/` et `scraped/` sont dans `.gitignore` : rien ne part sur git.
