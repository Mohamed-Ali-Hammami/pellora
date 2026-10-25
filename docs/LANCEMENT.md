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

- [ ] **Bloquant — Remplacer les douze fiches de démonstration.** Une seule
      fiche sur treize est renseignée d'après la documentation du fabricant
      (ETNA Luxe Anna 12EC). Les douze autres portent des modèles, des
      puissances et des classes énergétiques inventés, et le signalent en tête
      de page. Vendre un appareil de chauffage sur des caractéristiques
      inventées est une pratique commerciale trompeuse.
- [ ] **Bloquant — Trouver un vrai grossiste.** Les coûts dans
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
- [ ] **Bloquant — Renseigner le RIB** (`BANK_HOLDER`, `BANK_IBAN`, et de
      préférence `BANK_BIC` et `BANK_NAME`). Sans titulaire ni IBAN, la page de
      commande refuse d'enregistrer une commande.
- [ ] **Bloquant — Choisir un mot de passe de back-office** (`ADMIN_PASSWORD`,
      douze caractères minimum). En dessous, `/admin` reste fermé — et sans
      back-office, aucun virement ne peut être confirmé.
- [ ] **Désigner qui surveille le compte.** Le passage de « en attente de
      virement » à « confirmée » est manuel, par construction. Une commande
      payée que personne ne regarde est une vente perdue, et un client qui a
      viré son argent sans nouvelle devient un litige.
- [ ] **Bloquant — Configurer le SMTP** (`SMTP_HOST`, `SMTP_USER`,
      `SMTP_PASSWORD`). Sans cela, aucun e-mail ne part : le client n'a ni RIB
      ni référence, et il paie sans que vous puissiez rapprocher le virement.
      Avec Gmail, il faut un **mot de passe d'application**, pas le mot de
      passe du compte.
- [ ] **Faire en sorte que `EMAIL_FROM` soit acceptée par le serveur SMTP.**
      Avec Gmail, ce doit être l'adresse de `SMTP_USER`. Avec un domaine à
      vous, publiez SPF et DKIM, sinon les messages partent en courrier
      indésirable.
- [ ] **Renseigner `OPS_ALERT_EMAIL`.** C'est par là qu'arrivent les nouvelles
      commandes et les virements déclarés par les clients.
- [ ] **Remplacer les visuels.** Déposez les photos dans
      `public/img/products/<id-produit>/` puis lancez `npm run media:scan` ;
      les illustrations vectorielles s'effacent d'elles-mêmes. Minimum 600 px
      de côté, sinon le fichier est écarté et signalé. État actuel : **1 fiche
      sur 13** a ses photographies (ETNA Luxe Anna 12EC).
- [ ] **Faire une commande de test réelle**, avec un vrai virement de petit
      montant depuis un autre compte. Vérifiez les quatre étapes : e-mail avec
      le RIB reçu, commande visible dans /admin, confirmation reçue après le
      clic « virement reçu », avis d'expédition reçu après « marquer en
      route ».
- [ ] **Tester un échec d'envoi d'e-mail** (mot de passe SMTP volontairement
      faux) et vérifier que /admin affiche « la confirmation n'a pas pu être
      envoyée » au lieu de laisser croire le client prévenu.
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
- [ ] **Prévoir la trésorerie** : environ **88 000 €** pour le scénario de
      référence (90 commandes/mois). Vous payez la publicité et la marchandise
      avant d'être payé, et un poêle coûte ~1 180 € à l'achat : c'est le poste
      qui décide si l'activité tient. Relancez `npm run economics` après avoir
      saisi vos tarifs négociés — ce nombre bouge énormément avec eux.
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
