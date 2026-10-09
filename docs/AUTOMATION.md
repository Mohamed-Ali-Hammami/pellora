# L'automatisation : le pipeline et ses pannes

« Automatisé de A à Z » ne veut pas dire « sans panne ». Cela veut dire que les
pannes sont détectées, rattrapées, et signalées — jamais silencieuses. Un
client qui a payé et dont la commande n'est jamais partie est le pire incident
possible d'une boutique.

---

## Le parcours nominal

```
Client paie
    │
    ▼
Stripe envoie checkout.session.completed
    │
    ▼  /api/webhooks/stripe
Signature vérifiée (sinon 400 : l'URL est publique)
    │
    ▼  fulfillment.ts
┌─────────────────────────────────────────────┐
│ 1. Verrou posé sur la commande (120 s)      │
│ 2. Déjà transmise ? → on s'arrête           │
│ 3. E-mail de confirmation AU CLIENT         │
│ 4. Articles regroupés par fournisseur       │
│ 5. Une commande envoyée par fournisseur     │
│ 6. État enregistré par fournisseur          │
└─────────────────────────────────────────────┘
    │
    ▼
Le fournisseur expédie et appelle /api/webhooks/supplier
    │
    ▼
Numéro de suivi enregistré → e-mail « votre colis est parti »
```

Aucune étape ne demande d'intervention.

---

## Pourquoi le client est prévenu avant le fournisseur

L'ordre des étapes 3 et 5 n'est pas anodin. Un client sans confirmation pense
avoir perdu son argent, écrit au support, puis conteste le paiement auprès de
sa banque — une contestation coûte les frais de dossier, la marchandise, et
dégrade le score du compte Stripe. Un fournisseur servi dix minutes plus tard
ne change rien à rien.

Donc : **on rassure d'abord, on approvisionne ensuite.**

---

## Les trois garanties

### 1. Une commande ne peut pas être expédiée deux fois

Stripe **rejoue** ses webhooks : nouvelle tentative après un incident réseau,
double livraison, reprise après panne. Sans protection, chaque rejeu
déclencherait une nouvelle expédition, payée par vous.

Trois verrous successifs :

| Niveau | Mécanisme |
|---|---|
| Concurrence | `acquireLock()` — `SET NX EX` atomique dans Redis |
| Métier | `isFullyForwarded()` — vérifié même si le verrou a expiré |
| Fournisseur | `orderRef` stable, envoyé comme clé d'idempotence |

Vérifié par `tests/fulfillment.test.ts`, y compris deux appels simultanés.

### 2. Un échec partiel ne perd pas le fournisseur manquant

Une commande peut être répartie entre plusieurs grossistes. Si l'un réussit et
l'autre échoue, un simple drapeau « transmise » ferait considérer la commande
comme terminée — et l'article manquant ne serait **jamais** commandé.

L'état est donc suivi **par fournisseur** (`Order.supplierOrders`). Le
rattrapage ne reprend que ceux qui ont échoué.

### 3. Un échec ne reste jamais silencieux

| Incident | Réaction |
|---|---|
| Fournisseur injoignable | Statut `fulfillment_failed`, alerte, réessai automatique |
| 4 tentatives épuisées | Alerte « intervention manuelle requise » |
| Paiement sans adresse | Alerte avec l'e-mail du client |
| Paiement sans commande rattachée | Alerte pour rapprochement manuel dans Stripe |
| Confirmation client non partie | Alerte : le client ignore que sa commande existe |
| Contestation de paiement | Alerte immédiate avec le motif |

Les alertes partent vers `OPS_ALERT_EMAIL`. Sans cette variable, elles sont
journalisées — ce qui ne suffit pas en production.

---

## Le rattrapage planifié

`/api/cron/reconcile`, toutes les 15 minutes (`vercel.json`), protégé par
`CRON_SECRET`.

Il reprend les commandes en `fulfillment_failed`, jusqu'à 4 tentatives, et
alerte pour celles qui les ont épuisées. C'est ce qui fait qu'un fournisseur
indisponible pendant dix minutes ne se traduit pas par une commande payée
jamais expédiée.

---

## Changer de fournisseur

C'est la pièce qui change le plus souvent : rupture, délai qui dérape, qualité
qui baisse. Le code ne suppose donc jamais sa stabilité.

Trois adaptateurs, derrière une seule interface (`suppliers/types.ts`) :

| Adaptateur | Quand |
|---|---|
| `rest-supplier` | Le grossiste expose une API. `fieldMap` absorbe les différences de nommage. |
| `email-supplier` | Pas d'API : bon de commande structuré par e-mail. C'est le fonctionnement réel de beaucoup de grossistes européens, souvent les plus rapides. |
| simulation | Aucune configuration : journalise sans rien envoyer. Permet de dérouler tout le tunnel sans passer de vraie commande. |

Pour en ajouter un, implémentez `Supplier` et enregistrez-le dans
`suppliers/index.ts`. Rien d'autre ne bouge.

---

## Ce qui reste manuel

Soyons précis sur les limites :

- **Le service après-vente.** Un client qui écrit « le colis est cassé » a
  besoin d'une réponse humaine. Comptez 15 à 30 minutes par jour à partir d'une
  dizaine de commandes quotidiennes.
- **Les retours.** La réception physique et la décision de remboursement ne
  sont pas automatisées.
- **La comptabilité.** Rien ici ne produit de déclaration de TVA.
- **Les campagnes publicitaires.** Leur pilotage reste entièrement à votre
  charge, et c'est le poste qui détermine la rentabilité.

Le mot « automatisé » couvre le chemin paiement → expédition → notification.
Pas le reste.
