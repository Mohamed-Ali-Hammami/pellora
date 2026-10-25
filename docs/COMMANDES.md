# Le parcours d'une commande

Tout le processus tient en quatre états et trois e-mails. Il n'y a ni
prestataire de paiement, ni fournisseur branché au site, ni tâche planifiée :
c'est vous qui vendez, et c'est vous qui faites avancer chaque commande. Le
logiciel se contente de ne rien perdre et de prévenir le client.

---

## Le parcours

```
Le client valide son panier sur /commande
    │
    ▼  POST /api/orders
Panier RECALCULÉ côté serveur, commande créée en
« en attente de virement ». Le client voit le RIB et
sa référence à l'écran, et les reçoit par e-mail.
Vous recevez une alerte « nouvelle commande ».
    │
    ▼
Le client vire le montant en indiquant sa référence.
S'il le souhaite, il clique « j'ai fait le virement » :
ça ne change AUCUN état, ça vous dit juste de
regarder le compte.
    │
    ▼  ⟵ VOUS, dans /admin, relevé bancaire sous les yeux
« Virement reçu » → la commande passe en « confirmée »
et le client reçoit sa confirmation de commande.
    │
    ▼  ⟵ VOUS, quand le colis part
« Marquer en route » (+ transporteur et n° de suivi si
vous les avez) → le client reçoit son avis d'expédition.
    │
    ▼  ⟵ VOUS, quand la livraison est constatée
« Marquer livrée ».
```

Les quatre états sont `awaiting_transfer`, `confirmed`, `shipped`,
`delivered`, plus `cancelled`. Chacun correspond à un geste humain, et aucun
ne s'atteint autrement.

---

## Pourquoi déclarer son virement ne confirme rien

La page de suivi offre au client un bouton « j'ai effectué le virement ». Il
horodate une déclaration et vous alerte. Il ne fait pas avancer la commande,
et c'est le point entier : si un clic suffisait à passer en « confirmée », il
suffirait de cliquer pour qu'un poêle de 2 000 € parte sans qu'un centime
soit arrivé.

Vérifié par `tests/checkout.test.ts` — l'invariant est explicite.

---

## Ce qui protège l'argent et la marchandise

| Risque | Protection |
|---|---|
| Un prix modifié dans la console du navigateur | Le corps de `/api/orders` ne contient aucun prix : tout est relu dans le catalogue par `priceCart` |
| Une commande expédiée sans paiement | Seul `/admin`, derrière mot de passe, fait avancer une commande |
| Un double clic sur « virement reçu » | L'état de départ est vérifié : seule une commande en attente peut être confirmée |
| Deux e-mails de confirmation au même client | Le journal de la commande porte `email:confirmation_sent` ; l'envoi est sauté s'il a déjà eu lieu |
| Un virement sans référence lisible | Le nom du titulaire du compte est demandé au client quand il diffère du sien : c'est ce qui permet de rapprocher la ligne du relevé |
| Un e-mail qui ne part pas | L'état est enregistré AVANT l'envoi, et le back-office affiche « la confirmation n'a pas pu être envoyée » plutôt que de laisser croire le client prévenu |

---

## Les trois e-mails

| Message | Déclencheur | Contenu |
|---|---|---|
| Instructions de virement | Création de la commande | RIB, montant, référence à indiquer |
| Confirmation de commande | « Virement reçu » dans /admin | Récapitulatif, lien de suivi |
| Avis d'expédition | « Marquer en route » dans /admin | Transporteur et n° de suivi s'ils sont saisis |

Plus deux alertes internes vers `OPS_ALERT_EMAIL` : nouvelle commande
enregistrée, et virement déclaré par un client.

Le transport est un serveur SMTP ordinaire (`SMTP_HOST`, `SMTP_USER`,
`SMTP_PASSWORD`) — un compte Gmail avec un mot de passe d'application suffit.
**Sans configuration SMTP, aucun message ne part** : ils s'affichent dans la
console du serveur, préfixés `[e-mail:simulation]`. Pratique en
développement, inacceptable en production : le client n'aurait ni RIB ni
référence.

---

## Ce qui reste entièrement à votre charge

- **Constater les virements.** Aucun relevé bancaire ne dit de façon fiable
  quel virement correspond à quelle commande. C'est une consultation du compte
  une à deux fois par jour.
- **Commander chez votre grossiste.** Le site n'envoie rien à personne. Les
  prix d'achat et les références sont dans `src/lib/sourcing.ts`, pour le
  calcul de marge uniquement.
- **Expédier, ou faire expédier.** Et saisir le suivi dans /admin.
- **Le service après-vente, les retours, la comptabilité, la publicité.**

Rien ici ne tourne tout seul. C'est un outil de vente, pas un pilote
automatique — et à votre volume, c'est le bon compromis : la seule chose qu'un
automatisme aurait apportée, c'est le risque d'expédier sans être payé.
