# tools/

Outils autonomes, sans rapport avec la boutique. Python 3, aucune dépendance.

## `scrape.py` — extraire titre, description, prix et images d'une page

```bash
python3 tools/scrape.py <url> [<url>...]
python3 tools/scrape.py --fichier urls.txt --images
python3 tools/scrape.py --html-dir pages/          # hors ligne
python3 tools/scrape.py <url> --json               # JSON sur la sortie standard
```

Sort un `scraped/produits.json` et, avec `--images`, les visuels dans
`scraped/images/<ref>/`.

### Il n'utilise pas de sélecteurs CSS

Un scraper à sélecteurs ne marche que sur un site, et casse à la première
refonte. Celui-ci essaie cinq sources, de la plus normalisée à la plus
bricolée, et s'arrête dès qu'un champ est rempli :

| | Source | Ce que ça donne |
| - | ------ | --------------- |
| 1 | **JSON-LD** `schema.org/Product` | nom, description, images, prix, devise, marque, SKU, GTIN |
| 2 | **Microdata / RDFa** (`itemprop`) | les mêmes, sur les sites plus anciens |
| 3 | **OpenGraph / Twitter Card** | présent même sur les pages pauvres |
| 4 | **État des applications JS** | `__NEXT_DATA__`, `__NUXT__`, `__INITIAL_STATE__`, et tout `<script>` contenant du JSON, parcouru en profondeur |
| 5 | **Heuristique** | montants, `<title>`, plus grandes images |

La source 4 est celle qui permet de lire un site rendu côté navigateur **sans
navigateur** : la plupart de ces sites déposent leur état dans le HTML initial.

Chaque champ du résultat porte la méthode qui l'a trouvé, dans `methodes`.
Quand il manque un champ, la page est conservée dans `scraped/_pages/` — pas
d'échec silencieux.

### Ce qu'il ne peut pas faire

Une page dont le contenu n'arrive **qu'après** l'exécution du JavaScript, sans
aucun JSON dans le HTML initial, est hors de portée : il faut un vrai
navigateur. Le script le dit plutôt que de renvoyer des champs vides.

### Test

```bash
python3 tools/tests/test_scrape.py
```

Couvre 11 formats de montant et les 5 sources. Les cas présents sont ceux qui
ont réellement cassé pendant l'écriture : `2490.00` lu `249` (erreur d'un
facteur dix sur un prix), et `salePrice` ignoré faute de gérer le camelCase.
