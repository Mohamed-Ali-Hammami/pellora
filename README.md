# Verseuse — boutique dropshipping automatisée

Boutique e-commerce complète pour la niche **café filtre / infusion manuelle**,
conçue pour qu'aucune intervention humaine ne soit nécessaire entre le paiement
du client et l'expédition par le fournisseur.

Next.js 16 · TypeScript · Tailwind 4 · Stripe · Resend · Redis

---

## Ce que ce dépôt contient, et ce qu'il ne contient pas

**Il contient** une boutique fonctionnelle et testée : catalogue, panier,
paiement, transmission automatique des commandes au fournisseur, e-mails
transactionnels, suivi de commande, pages légales françaises, contenu
éditorial, et un modèle économique chiffré.

**Il ne contient pas** ce qui ne peut pas être écrit depuis un clavier :

| Ce qui manque | Pourquoi |
|---|---|
| Un vrai fournisseur | À négocier. Les coûts d'achat dans `src/lib/sourcing.ts` sont des **hypothèses de travail**, pas des tarifs obtenus. |
| De vraies photos produit | Les visuels sont des SVG marqués « VISUEL À REMPLACER ». |
| Les mentions légales réelles | Les pages portent des champs `[À COMPLÉTER]` : publier des coordonnées d'entreprise inventées n'aurait aucune valeur juridique. |
| Un nom disponible | « Verseuse » n'a été vérifié ni en nom de domaine, ni à l'INPI. |
| Une garantie de chiffre d'affaires | Voir [docs/ECONOMICS.md](docs/ECONOMICS.md). Le modèle dit ce qui doit être vrai ; seule votre dépense publicitaire réelle dira si ça l'est. |

---

## Démarrage

```bash
npm install
cp .env.example .env.local     # facultatif pour un premier coup d'œil
npm run dev                    # http://localhost:3000
```

Sans aucune variable d'environnement, le site démarre et se parcourt
intégralement : le paiement est simplement désactivé, les e-mails partent en
console et aucune commande n'est transmise. C'est délibéré — on peut tout
explorer sans risquer une vraie commande.

### Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm test` | 75 tests unitaires |
| `npm run typecheck` | TypeScript en mode strict |
| `npm run verify` | Les trois ci-dessus, à lancer avant tout déploiement |
| `npm run economics` | Simulateur de rentabilité (voir options plus bas) |

---

## Architecture

```
src/
├── lib/
│   ├── money.ts          Centimes entiers, TVA extraite (jamais de flottant)
│   ├── catalog.ts        Catalogue PUBLIC — aucune donnée sensible
│   ├── sourcing.ts       Coûts d'achat et références — SERVEUR UNIQUEMENT
│   ├── cart.ts           Chiffrage du panier (pur, testable)
│   ├── shipping.ts       Zones, tarifs, seuil de gratuité
│   ├── economics.ts      Modèle de rentabilité
│   ├── fulfillment.ts    Orchestrateur : paiement → fournisseur → e-mails
│   ├── suppliers/        Adaptateurs interchangeables (REST, e-mail, simulation)
│   ├── store/            Persistance des commandes (Redis ou mémoire)
│   └── email/            Transport et gabarits transactionnels
├── app/
│   ├── api/              checkout · webhooks Stripe et fournisseur · suivi · cron
│   └── …                 Pages publiques
```

### Trois règles structurantes

**1. Le client n'envoie jamais un prix.** Le panier ne transmet que des
identifiants et des quantités ; `priceCart()` relit chaque prix dans le
catalogue côté serveur. Sans cela, modifier un montant dans la console du
navigateur suffirait à payer un centime. Vérifié par `tests/cart.test.ts`.

**2. Tout montant est un entier de centimes.** `0.1 + 0.2` vaut
`0.30000000000000004` en flottant : à l'échelle de milliers de commandes, cela
produit des écarts d'un centime entre le panier, Stripe et la comptabilité. La
TVA est *extraite* du prix TTC, jamais ajoutée par-dessus.

**3. Les coûts d'achat ne quittent pas le serveur.** `sourcing.ts` lève une
erreur s'il est chargé dans un navigateur, et `tests/leakage.test.ts` refuse
tout import d'un module serveur depuis un composant client.

---

## Configuration

Tout est dans `.env.example`, commenté ligne par ligne. L'essentiel :

| Variable | Rôle | Obligatoire |
|---|---|---|
| `STRIPE_SECRET_KEY` | Paiement | pour encaisser |
| `STRIPE_WEBHOOK_SECRET` | Signature des webhooks | pour encaisser |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Persistance des commandes | **en production** |
| `RESEND_API_KEY` / `EMAIL_FROM` | E-mails transactionnels | pour notifier |
| `SUPPLIER_API_URL` + `_KEY` *ou* `SUPPLIER_ORDER_EMAIL` | Transmission des commandes | pour expédier |
| `SUPPLIER_WEBHOOK_SECRET` | Réception des numéros de suivi | pour le suivi |
| `CRON_SECRET` | Protège le rattrapage planifié | **en production** |
| `NEXT_PUBLIC_ALLOW_INDEXING` | `true` le jour du lancement seulement | — |

Sans Redis en production, les commandes sont stockées en mémoire et **perdues
au redémarrage** : le suivi client cesse de fonctionner et une commande payée
peut disparaître. Le code le signale bruyamment dans les journaux.

---

## Déploiement

Pensé pour Vercel, mais rien n'y est spécifique sauf `vercel.json` (la tâche
planifiée).

1. Poussez le dépôt, importez-le dans Vercel.
2. Renseignez les variables d'environnement.
3. Créez le point de terminaison Stripe vers `https://votre-domaine/api/webhooks/stripe`
   avec les événements `checkout.session.completed`, `checkout.session.expired`,
   `charge.refunded`, `charge.dispute.created`.
4. Vérifiez votre domaine dans Resend (sans quoi les e-mails partent en spam).
5. Passez `NEXT_PUBLIC_ALLOW_INDEXING` à `true` **après** avoir rempli les
   mentions légales et remplacé les visuels.

La liste complète avant encaissement de la première commande :
[docs/LANCEMENT.md](docs/LANCEMENT.md).

---

## Changer de niche

Le code ne sait rien du café. Pour vendre autre chose :

1. `src/lib/brand.ts` — nom, promesses, adresses
2. `src/lib/catalog.ts` — produits (le reste du site s'y adapte seul)
3. `src/lib/sourcing.ts` — coûts d'achat et références fournisseur
4. `src/lib/guides.ts` — contenu éditorial
5. `public/img/` — visuels

`npm test` signalera toute incohérence : catégorie sans intitulé, référence
croisée morte, produit vendu à perte, marge sous 45 %.

---

## Documentation

- [docs/ECONOMICS.md](docs/ECONOMICS.md) — ce qu'il faut pour 5 000 €/mois, par le calcul
- [docs/AUTOMATION.md](docs/AUTOMATION.md) — le pipeline, ses modes de panne et ses garanties
- [docs/LANCEMENT.md](docs/LANCEMENT.md) — tout ce qui reste à faire avant la première vente
