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

## `images.py` — chercher des images par mot-clé

```bash
python3 tools/images.py "chimenea electrica HOMCOM 1800W" -n 20
python3 tools/images.py --depuis-json scraped/produits.json --cle titre
python3 tools/images.py "KEKAI Oregon" --moteur bing --min 800
python3 tools/images.py "..." --sans-telechargement --json   # lister sans écrire
```

### Quatre moteurs, essayés dans l'ordre

Aucun moteur d'images n'expose d'API publique stable, et chacun casse à son
rythme. Le script en empile quatre, passe au suivant quand l'un ne rend rien,
et **dit lequel a répondu** :

| Moteur | Comment |
| ------ | ------- |
| `commons` | API Wikimedia Commons. Une vraie API JSON, sans clé. Peu de produits, mais ça marche toujours. |
| `ddg` | DuckDuckGo. Jeton `vqd` sur la page de recherche, puis point d'entrée JSON. |
| `bing` | Chaque vignette porte un attribut `m="{...}"` avec l'URL d'origine (`murl`). Stable depuis des années. |
| `google` | Le plus fourni, le plus hostile : le HTML ne porte plus que des miniatures en base64. Trois formes tentées. |

**Si Google ne rend rien, c'est attendu.** Les vraies URL vivent dans des blocs
de script qui demandent un navigateur. Utilise `--moteur bing` ou `ddg`.

### Au téléchargement

- la **taille réelle** est lue dans l'en-tête du fichier, et `--min` écarte les
  vignettes — une recherche d'images en rend beaucoup ;
- les doublons sont détectés par **empreinte du contenu**, pas par URL : le même
  visuel est souvent servi depuis cinq domaines ;
- une page d'erreur HTML renvoyée en HTTP 200 est reconnue à ses octets
  d'en-tête et jetée.

### Test

```bash
python3 tools/tests/test_images.py
```

22 vérifications : dimensions sur les quatre formats (fichiers fabriqués
octet par octet), parseurs des quatre moteurs sur réponses enregistrées, et
l'enchaînement automatique. A trouvé un bug : l'en-tête WebP VP8X fait
exactement 30 octets, et la borne était `> 30`.

## `collect.py` — l'orchestrateur

```bash
python3 tools/collect.py --urls urls.txt
python3 tools/collect.py --urls urls.txt --images-manquantes
python3 tools/collect.py --requetes mots-cles.txt --rps 0.5
python3 tools/collect.py --urls urls.txt --rps 1 --concurrence 4 --reprendre
```

Pilote `scrape.py` et `images.py`, écrit `collect/donnees.json`, les visuels
dans `collect/images/<sku>/`, et un journal reprenable.

### Comment la limite de débit est réellement tenue

Le point de passage obligé de tout le trafic des deux scripts est
`urllib.request.urlopen`. L'orchestrateur le **remplace une fois** au démarrage
par une version régulée. Les deux scripts restent inchangés et ne savent rien
de tout ça : il n'existe donc **aucun chemin** par lequel une requête pourrait
échapper à la limite — pas même une requête ajoutée plus tard dans `scrape.py`.

Ce qui est appliqué, **par hôte** et non globalement :

| | |
| - | - |
| **Seau à jetons** | `--rps` en régime établi, `--burst` d'avance au démarrage. Un seau, pas un `sleep` : ça autorise une rafale courte après une période calme, ce qu'un serveur tolère le mieux. |
| **Un appel à la fois** | un verrou par hôte. La concurrence joue **entre** hôtes, jamais sur un seul. |
| **robots.txt** | lu une fois par hôte. `Disallow` écarte l'URL ; `Crawl-delay` **écrase** `--rps` s'il est plus lent — le site a le dernier mot, mais un `Crawl-delay` plus rapide ne nous accélère pas. |
| **429 / 503** | `Retry-After` lu et respecté. Sans en-tête, la pause double à chaque refus consécutif, plafonnée à 5 min. Un succès remet le compteur à zéro. |

### Reprise

Chaque résultat est ajouté au journal JSONL **dès qu'il arrive**. Une
interruption — Ctrl-C, coupure, machine éteinte — ne perd que la page en cours,
et `--reprendre` saute tout ce qui est déjà au journal. Une ligne tronquée par
une coupure est ignorée sans casser la reprise.

### Test

```bash
python3 tools/tests/test_collect.py
```

24 vérifications, dont la cadence **mesurée au chronomètre** contre un vrai
serveur HTTP local : un régulateur qu'on n'a pas chronométré n'est pas un
régulateur, c'est une intention.
