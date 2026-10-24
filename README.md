# Pellora — boutique dropshipping poêles à granulés, en quatre langues

Boutique e-commerce complète pour la niche **poêles à granulés** — deux
familles, **hydro** et **air ventilé** — en **français, anglais, néerlandais et
espagnol**, conçue pour qu'aucune intervention humaine ne soit nécessaire entre
le paiement du client et l'expédition par le fournisseur.

Next.js 16 · TypeScript · Tailwind 4 · Resend · Redis

---

## Ce que ce dépôt contient, et ce qu'il ne contient pas

**Il contient** une boutique fonctionnelle et testée : catalogue traduit,
calculateur de puissance, panier, commande payée par virement, back-office de
validation, transmission automatique des
commandes au fournisseur, e-mails transactionnels dans la langue du client,
suivi de commande, pages légales, contenu éditorial, et un modèle économique
chiffré.

**Il ne contient pas** ce qui ne peut pas être écrit depuis un clavier :

| Ce qui manque | Pourquoi |
|---|---|
| Un vrai fournisseur | À négocier. Les coûts d'achat de `src/lib/sourcing.ts` sont des **hypothèses de travail**, pas des tarifs obtenus. |
| De vraies fiches techniques | Les modèles, puissances, rendements et classes énergétiques du catalogue sont **plausibles mais fictifs**. Voir l'avertissement ci-dessous : ce point n'est pas cosmétique. |
| De vraies photos produit | Les visuels sont des illustrations vectorielles, signalées comme telles sur chaque fiche. Voir [Ajouter vos photos](#ajouter-vos-photos). |
| Les mentions légales réelles | Renseignées par variables d'environnement. Tant qu'elles manquent, les pages concernées affichent un avertissement visible. |
| Un nom disponible | « Pellora » n'a été vérifié ni en nom de domaine, ni auprès d'un office de marques. |
| Une garantie de chiffre d'affaires | Voir [docs/ECONOMICS.md](docs/ECONOMICS.md). Le modèle dit ce qui doit être vrai ; seule votre dépense publicitaire réelle dira si ça l'est. |

### ⚠ Avant la première vente : les données du catalogue

Un poêle à granulés est un **appareil réglementé**. La puissance, le rendement,
les émissions et la classe énergétique affichées doivent reprendre **à
l'identique** la fiche technique et l'étiquette énergétique du fabricant
(règlements UE 2015/1185 et 2015/1186, norme EN 14785).

Les valeurs livrées dans `src/lib/catalog.ts` sont **fictives**. Les annoncer
telles quelles engagerait votre responsabilité de vendeur, et rendrait par
ailleurs vos clients inéligibles aux aides qui exigent une classe ou un
rendement donnés.

Tant que `NEXT_PUBLIC_DEMO_CATALOG` n'est pas à `false`, un bandeau le rappelle
sur chaque page, et `robots.ts` interdit l'indexation.

---

## Démarrage

```bash
npm install
cp .env.example .env.local     # facultatif pour un premier coup d'œil
npm run dev                    # http://localhost:3000 → redirige vers /fr
```

Sans aucune variable d'environnement, le site démarre et se parcourt
intégralement dans les quatre langues : le paiement est simplement désactivé,
les e-mails partent en console et aucune commande n'est transmise. C'est
délibéré — on peut tout parcourir sans risque.

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run verify` | Types + 168 tests + build de production. **À lancer avant chaque commit.** |
| `npm run test` | Tests seuls (Vitest) |
| `npm run typecheck` | Types seuls |
| `npm run media:scan` | Détecte les photos déposées dans `public/img/products/` |
| `npm run placeholders` | Régénère les illustrations de substitution |
| `npm run economics` | Imprime le modèle économique chiffré |

---

## Les quatre langues

Le site est traduit en **français, anglais, néerlandais, espagnol**. Les URL le
sont aussi :

| | français | anglais | néerlandais | espagnol |
|---|---|---|---|---|
| Boutique | `/fr/poeles` | `/en/stoves` | `/nl/kachels` | `/es/estufas` |
| Hydro | `/fr/poeles/hydro` | `/en/stoves/hydro` | `/nl/kachels/hydro` | `/es/estufas/hidro` |
| Calculateur | `/fr/calcul-puissance` | `/en/power-calculator` | `/nl/vermogen-berekenen` | `/es/calculo-potencia` |
| Panier | `/fr/panier` | `/en/cart` | `/nl/winkelwagen` | `/es/carrito` |

Les slugs produits et guides sont traduits eux aussi : un slug français ne
répond pas sous le préfixe espagnol, ce qui évite le contenu dupliqué.

### Comment c'est construit

- **`src/lib/i18n/dictionaries/fr.ts` fait contrat.** Le type `Dictionary` est
  `typeof fr` : une clé oubliée en néerlandais devient une **erreur
  TypeScript**, pas un texte manquant en production. Pour ajouter un texte :
  l'ajouter dans `fr.ts`, puis suivre les erreurs.
- **`src/lib/i18n/routes.ts`** tient la table des URL. L'arborescence
  `src/app/[locale]/` garde des noms canoniques en anglais (un dossier par
  page, pas quatre) et `src/proxy.ts` réécrit l'URL publique vers elle.
- **`src/lib/i18n/equivalent.ts`** calcule l'URL équivalente d'une page dans
  une autre langue. C'est ce qui fait que le sélecteur de langue emmène sur la
  **même fiche produit**, et non sur l'accueil.
- Chaque page porte ses balises `hreflang`, son `canonical` et son
  `x-default` ; le plan du site déclare les quatre variantes de chaque URL.
- La langue est **stockée avec la commande** : un e-mail de suivi envoyé trois
  jours plus tard par une tâche planifiée part dans la langue d'achat.

### Ajouter une cinquième langue

1. ajouter le code dans `locales` (`src/lib/i18n/config.ts`) et renseigner
   `localeNames`, `intlLocales`, `htmlLangs`, `ogLocales`, `stripeLocales` ;
2. créer `src/lib/i18n/dictionaries/<code>.ts` typé `Dictionary` et le déclarer
   dans `dictionaries/index.ts` ;
3. compléter la colonne de la langue dans `localizedPaths` (`routes.ts`) ;
4. compléter les champs `Localized` de `catalog.ts`, `guides.ts`, `brand.ts`,
   `shipping.ts`.

Le compilateur signale chacun de ces points s'il est oublié. `npm run verify`
refuse de passer tant que les quatre premiers ne sont pas faits.

---

## Ajouter vos photos

Les visuels livrés sont des illustrations vectorielles, pas des photographies.
Elles sont signalées comme telles sur chaque fiche — présenter un dessin comme
une photo de produit serait une pratique commerciale trompeuse.

Pour les remplacer :

```bash
# un dossier par produit, nommé avec son identifiant de catalogue
public/img/products/aria-6/01.jpg
public/img/products/aria-6/02.jpg
public/img/products/idro-15/01.webp

npm run media:scan
```

Le site sert alors les photos à la place des illustrations, sans aucune
modification de code. Le détail et la liste des identifiants sont dans
[`public/img/products/README.md`](public/img/products/README.md).

**Droits d'usage.** N'utilisez que des visuels dont l'usage vous est concédé :
le *media pack* de votre fournisseur (c'est la voie normale en dropshipping,
demandez-le par écrit), vos propres photos, ou une banque d'images sous licence
commerciale explicite. Une photo récupérée via un moteur de recherche reste
protégée par le droit d'auteur, même sans mention de copyright, et les agences
pratiquent la facturation rétroactive.

---

## Brancher le paiement

Le règlement se fait par **virement bancaire**, validé à la main par l'équipe.
Il n'y a aucun prestataire de paiement, donc aucune donnée de carte, donc
aucune obligation PCI-DSS.

1. Renseignez le RIB dans `.env.local` :

   ```
   BANK_HOLDER=Votre raison sociale
   BANK_IBAN=FR76...
   BANK_BIC=...
   BANK_NAME=Votre banque
   ```

   Sans titulaire ni IBAN, la page de commande affiche un avertissement et
   refuse d'enregistrer une commande : un client ne doit jamais se retrouver
   avec une commande qu'il ne peut pas payer.

2. Choisissez un mot de passe de back-office, douze caractères au minimum :

   ```
   ADMIN_PASSWORD=$(openssl rand -base64 24)
   ```

### Le parcours

```
panier → /commande → le client saisit ses coordonnées
                   → commande enregistrée, état « en attente de virement »
                   → e-mail au client : RIB, montant, référence
                   → e-mail à l'équipe : nouvelle commande

/admin → l'équipe constate le virement sur le relevé
       → « Virement reçu » → état « confirmée »
       → transmission automatique au fournisseur
       → numéro de suivi → « en route » → « livrée »
```

**Rien n'est automatique entre le virement et la confirmation**, et c'est
délibéré : seule une personne qui a vu la ligne sur le relevé peut faire
avancer une commande. Une commande transmise au fournisseur sans virement reçu
est une perte sèche.

La référence de commande (`PEL-XXXXXX`) est ce qui rattache un virement à une
commande. Elle est répétée trois fois dans l'e-mail client — objet, corps,
encadré du RIB — parce qu'un virement sans référence se retrouve à la main sur
un relevé.

## Avant de vendre : la liste à cocher

| | À faire | Où |
|---|---|---|
| ☐ | Remplacer les fiches techniques par celles du fournisseur | `src/lib/catalog.ts` |
| ☐ | Remplacer les coûts d'achat par vos tarifs négociés | `src/lib/sourcing.ts` |
| ☐ | Déposer les vraies photos | `public/img/products/` |
| ☐ | Renseigner l'identité de l'exploitant | `LEGAL_*` dans `.env.local` |
| ☐ | Faire relire les CGV par un juriste | `dictionaries/*.ts`, section `terms` |
| ☐ | Désigner un médiateur de la consommation | `LEGAL_MEDIATOR` |
| ☐ | Vérifier la grille de port auprès du transporteur | `src/lib/shipping.ts` |
| ☐ | Faire relire les traductions par un locuteur natif | `dictionaries/` |
| ☐ | Brancher Redis (sinon les commandes sont perdues au redémarrage) | `UPSTASH_*` |
| ☐ | Passer `NEXT_PUBLIC_DEMO_CATALOG` à `false` | `.env.local` |
| ☐ | Passer `NEXT_PUBLIC_ALLOW_INDEXING` à `true` | `.env.local` |

Les trois dernières lignes ne doivent être cochées **qu'une fois les autres
faites** : tant qu'elles ne le sont pas, le site s'interdit lui-même d'être
indexé et affiche ses avertissements.

---

## Architecture

```
src/
├─ proxy.ts                  Routage des langues (redirection, réécriture, cookie)
├─ app/
│  ├─ [locale]/              Toutes les pages, un dossier par page et non par langue
│  └─ api/                   Commandes, webhook fournisseur, suivi, reprise
├─ components/               Composants serveur, et îlots client là où c'est nécessaire
└─ lib/
   ├─ i18n/                  Langues, dictionnaires, table des URL, équivalences
   ├─ catalog.ts             SOURCE DE VÉRITÉ du catalogue — importable côté client
   ├─ sourcing.ts            Coûts d'achat — SERVEUR UNIQUEMENT
   ├─ cart.ts                Tarification du panier — le seul endroit qui calcule un total
   ├─ shipping.ts            Grille de port palette / colis
   ├─ sizing.ts              Pré-dimensionnement de la puissance
   ├─ stripe.ts              Sessions de paiement — SERVEUR UNIQUEMENT
   ├─ store/                 Commandes : cycle de vie, persistance, idempotence
   ├─ suppliers/             Adaptateurs fournisseur (API REST ou bon de commande e-mail)
   └─ email/                 Gabarits transactionnels, traduits
```

### Trois frontières qui ne doivent pas bouger

1. **`sourcing.ts` ne doit jamais partir dans le navigateur.** Un concurrent
   qui lit vos coûts d'achat connaît votre marge et votre grossiste. Trois
   protections se cumulent : une garde d'exécution, le test
   `tests/leakage.test.ts` qui refuse tout import depuis un composant client,
   et la revue de code.
2. **Un total ne se calcule que dans `priceCart()`.** Partout ailleurs, les
   montants affichés sont indicatifs.
3. **Un montant est toujours un entier de centimes.** `0.1 + 0.2` vaut
   `0.30000000000000004` : les flottants finissent par produire des écarts d'un
   centime entre le panier, le virement attendu et la comptabilité.

---

## Documentation

- [docs/ECONOMICS.md](docs/ECONOMICS.md) — le modèle économique, et ce qu'il
  faut que la publicité coûte pour que la boutique soit rentable
- [docs/AUTOMATION.md](docs/AUTOMATION.md) — ce qui tourne sans vous, et ce qui
  reste manuel
- [docs/LANCEMENT.md](docs/LANCEMENT.md) — la mise en ligne, étape par étape

---

## Tests

```bash
npm run test
```

168 tests, dont :

- **parité des quatre dictionnaires** — mêmes clés, mêmes longueurs de liste,
  aucun texte vide ;
- **table de routage** — pas deux routes sur une même URL, le préfixe le plus
  long gagne, et les deux sens de traduction ne peuvent jamais répondre
  ensemble (sinon le proxy boucle) ;
- **équivalences entre langues** — le sélecteur mène à la même page ;
- **étanchéité client / serveur** — aucun composant client n'importe un module
  serveur ;
- **tarification** — la TVA est extraite et non ajoutée, les prix sont relus
  dans le catalogue, un panier palettisé refuse un tarif colis ;
- **marges** — aucun produit vendu à perte, planchers par famille.
