# Avant d'encaisser la première commande

Liste de ce qui reste à faire. Les points marqués **bloquant** exposent à une
sanction ou à une perte d'argent s'ils sont ignorés.

---

## 1. Entreprise et obligations légales

- [ ] **Bloquant — Immatriculer l'activité.** Micro-entreprise suffit pour
      démarrer. Vendre sans structure, c'est du travail dissimulé.
- [ ] **Bloquant — Compléter les mentions légales.** Tous les champs
      `[À COMPLÉTER]` dans `/mentions-legales`, `/cgv` et `/confidentialite` :
      dénomination, forme juridique, SIREN, adresse, TVA intracommunautaire,
      directeur de publication, hébergeur.
- [ ] **Bloquant — Adhérer à un médiateur de la consommation.** Obligation
      légale pour tout vendeur en ligne à destination de consommateurs français
      (art. L. 612-1 du code de la consommation), à souscrire **avant** la
      première vente. Comptez 30 à 80 € par an.
- [ ] **Vérifier le nom.** « Pellora » n'a été vérifié ni en nom de domaine,
      ni à l'INPI. Faites les deux avant d'imprimer quoi que ce soit.
- [ ] **TVA.** En franchise en base, pas de TVA facturée : il faut alors
      retirer les mentions « TVA incluse » et passer `DEFAULT_VAT_RATE` à `0`
      dans `src/lib/money.ts`. Au-delà des seuils, la TVA s'applique et le code
      est déjà correct.
- [ ] **Faire relire les CGV.** Le texte fourni est une base de travail
      sérieuse, pas un avis juridique.

---

## 2. Fournisseur

- [ ] **Bloquant — Trouver un vrai fournisseur.** Les coûts dans
      `src/lib/sourcing.ts` sont des hypothèses. Toute la rentabilité dépend de
      ces nombres : remplacez-les par vos tarifs négociés.
- [ ] **Exiger un entrepôt européen.** C'est ce qui permet 2 à 4 jours de
      livraison au lieu de 2 à 4 semaines, et ce qui rend les retours
      praticables.
- [ ] **Bloquant — Vérifier la conformité GPSR.** Depuis décembre 2024, tout
      produit vendu à un consommateur de l'Union doit avoir un « responsable
      établi dans l'UE » identifiable. Un fournisseur européen règle le
      problème ; un envoi direct depuis l'Asie vous le transfère entièrement.
- [ ] **Commander les produits pour soi.** Avant de les vendre. Vérifiez la
      qualité réelle, le délai réel, l'état du colis, et prenez vos photos.
- [ ] **Obtenir un second fournisseur.** Le code gère plusieurs grossistes ;
      une rupture chez l'unique fournisseur arrête la boutique.
- [ ] **Confirmer l'absence de marque tierce** dans le colis et sur le bon de
      livraison.

---

## 3. Technique

- [ ] **Bloquant — Configurer Redis** (`UPSTASH_REDIS_REST_URL` et `_TOKEN`).
      Sans persistance, une commande payée peut être perdue et le suivi ne
      fonctionne pas.
- [ ] **Bloquant — Créer le webhook Stripe** vers
      `https://votre-domaine/api/webhooks/stripe`, événements
      `checkout.session.completed`, `checkout.session.expired`,
      `charge.refunded`, `charge.dispute.created`. Reportez la clé secrète dans
      `STRIPE_WEBHOOK_SECRET`.
- [ ] **Vérifier le domaine dans Resend** (SPF, DKIM). Sans cela, les
      confirmations partent en courrier indésirable.
- [ ] **Renseigner `OPS_ALERT_EMAIL`.** C'est par là qu'arrivent les incidents.
- [ ] **Générer `CRON_SECRET` et `SUPPLIER_WEBHOOK_SECRET`**
      (`openssl rand -hex 32`).
- [ ] **Remplacer les visuels** dans `public/img/`. Les SVG actuels portent la
      mention « VISUEL À REMPLACER ».
- [ ] **Faire une commande de test réelle**, en cartes de test puis en
      conditions réelles avec un petit montant. Vérifiez : confirmation reçue,
      commande transmise, suivi affiché.
- [ ] **Tester un échec fournisseur** (clé d'API invalide) et vérifier que
      l'alerte arrive et que le rattrapage reprend la commande.
- [ ] **Passer `NEXT_PUBLIC_ALLOW_INDEXING` à `true`** — en dernier, une fois
      tout le reste fait.

---

## 4. Commercial

- [ ] **Mesurer avant de conclure.** Dépensez 300 à 500 € de publicité pour
      obtenir votre CPC et votre conversion réels, puis relancez
      `npm run economics` avec ces valeurs. Tant qu'ils ne sont pas mesurés, la
      rentabilité est une hypothèse.
- [ ] **Surveiller le panier moyen.** C'est le paramètre qui décide
      (voir [ECONOMICS.md](ECONOMICS.md)). En dessous de 100 €, la marge ne
      finance pas l'acquisition.
- [ ] **Prévoir la trésorerie** : environ 6 450 € pour le scénario de
      référence. Vous payez la publicité et la marchandise avant d'être payé.
- [ ] **Publier du contenu.** Le trafic organique est le seul levier qui fasse
      baisser durablement le CAC. Deux guides sont fournis ; il en faut
      davantage.
- [ ] **Définir un seuil d'arrêt.** Décidez *maintenant* du montant que vous
      acceptez de perdre avant de conclure que le modèle ne fonctionne pas.
      Cette décision est impossible à prendre lucidement une fois engagé.

---

## Ce qui ne figure pas dans cette liste

Aucune case ne garantit le chiffre d'affaires. La boutique est un outil
correctement construit ; ce qu'on en tire dépend du produit, du marché et de
l'exécution publicitaire — trois choses qui se mesurent sur le terrain et ne se
décrètent pas depuis un dépôt de code.
