# Ce qu'il faut pour 5 000 € par mois

Ce document répond par le calcul, pas par une promesse. Tous les chiffres
viennent de `npm run economics`, que vous pouvez relancer avec vos propres
hypothèses.

---

## L'identité qui décide de tout

```
CAC = CPC / taux de conversion
```

Le coût d'acquisition d'un client est le coût par clic divisé par le taux de
conversion. Un CPC de 0,70 € avec 2 % de conversion donne **35 € pour obtenir
une commande**. Aucune astuce de site ne contourne cette division. On ne peut
agir que sur trois choses : le CPC (ciblage, créas), la conversion (fiche
produit, prix, réassurance) et la marge par commande (panier moyen, coût
d'achat).

---

## La marge réelle sur une commande de 92 €

| Poste | Montant |
|---|---|
| Encaissé TTC | 92,00 € |
| TVA reversée (÷ 1,20) | −15,33 € |
| **Chiffre d'affaires HT** | **76,67 €** |
| Coût d'achat marchandise | −29,00 € |
| Port payé au fournisseur | −5,90 € |
| Commission Stripe (1,5 % + 0,25 €) | −1,63 € |
| Provision retours (4 %) | −1,84 € |
| **Marge avant publicité** | **38,30 €** |

Ces 38,30 € sont le **plafond absolu du CAC**. Au-delà, chaque vente creuse la
perte — et augmenter le volume l'aggrave.

---

## Le scénario de départ ne tient pas

Avec les hypothèses de base (panier 92 €, CPC 0,70 €, conversion 2 %) :

```
CAC                                35,00 €
Marge avant publicité              38,30 €
Marge après publicité               3,30 €   ← il ne reste presque rien
```

Pour dégager 5 000 € de bénéfice mensuel avec 3,30 € par commande :

| | |
|---|---|
| Commandes par mois | **1 645** (54 par jour) |
| Visites nécessaires | 82 250 |
| Budget publicitaire | **57 575 €/mois** |
| Chiffre d'affaires | 151 340 €/mois |
| Marge nette | **3,3 %** |

Ce n'est pas une entreprise, c'est une machine à faire transiter de l'argent
vers une régie publicitaire. **Le scénario de départ est à rejeter.**

---

## Le scénario qui tient

Deux changements suffisent à tout renverser : panier moyen à 115 € et
conversion à 2,8 %.

```
CAC                                25,00 €
Marge avant publicité              56,36 €
Marge après publicité              31,36 €   ← dix fois plus
```

| | Départ | Corrigé |
|---|---|---|
| Commandes par mois | 1 645 | **173** (5,7/jour) |
| Budget publicitaire | 57 575 € | **4 325 €** |
| Chiffre d'affaires | 151 340 € | 19 895 € |
| Marge nette | 3,3 % | **25,2 %** |

**+25 % de panier moyen et +0,8 point de conversion font passer l'objectif de
54 commandes par jour à 6.**

La raison est mathématique : le nombre de commandes nécessaires vaut
`(objectif + charges fixes) / (marge − CAC)`. Quand le dénominateur approche
zéro, le résultat explose. Près du seuil de rentabilité, une variation
minuscule change tout — dans les deux sens.

---

## Ce que le site fait de cette conclusion

Le modèle a dicté des choix concrets dans le code :

- **Le lot à 149 € est mis en avant avant le kit à 89 €** sur la page
  d'accueil. À coût d'acquisition égal, c'est le panier moyen qui décide.
- **Livraison offerte dès 60 €** (`FREE_SHIPPING_THRESHOLD`) : le levier le
  plus direct sur le panier moyen.
- **Ventes croisées sur chaque fiche produit et au panier.**
- **Contenu éditorial** (`src/lib/guides.ts`) : le trafic organique est le seul
  levier qui fasse baisser durablement le CAC. Une boutique qui ne vit que de
  publicité voit sa marge captée par la régie dès que les enchères montent.
- **Un test refuse toute marge brute sous 45 %** (`tests/sourcing.test.ts`) :
  en dessous, la publicité n'est pas finançable.

---

## Sensibilité : ce qui compte vraiment

Bénéfice mensuel à 400 commandes, un paramètre à la fois.

| Conversion | Bénéfice | | CPC | Bénéfice |
|---|---|---|---|---|
| 1,2 % | −8 435 € | | 0,40 € | 6 898 € |
| 1,6 % | −2 602 € | | 0,55 € | 3 898 € |
| 2,0 % | 898 € | | 0,70 € | 898 € |
| 2,5 % | 3 698 € | | 0,90 € | −3 102 € |
| 3,0 % | 5 565 € | | 1,20 € | −9 102 € |

| Panier moyen | Bénéfice | | Coût d'achat | Bénéfice |
|---|---|---|---|---|
| 70 € | −6 015 € | | 22 € | 3 698 € |
| 80 € | −2 873 € | | 26 € | 2 098 € |
| 92 € | 898 € | | 29 € | 898 € |
| 110 € | 6 554 € | | 34 € | −1 102 € |
| 130 € | 12 839 € | | 40 € | −3 502 € |

Lecture : **doubler le CPC détruit l'activité ; gagner 20 € de panier moyen la
sauve.** C'est pourquoi le site est construit autour du panier moyen.

---

## Ce que je ne peux pas vous dire

Je n'ai **pas de source vérifiée** pour le CPC ni le taux de conversion de
cette niche aujourd'hui. Ces deux nombres sont des hypothèses plausibles, ce
sont ceux qui pèsent le plus sur le résultat, et ils ne se mesurent qu'avec de
la dépense réelle.

Plus largement : tout ce que je pourrais « savoir » d'un produit qui marche
date au mieux de mai 2026, donc toute niche que je désignerais comme porteuse
est probablement déjà saturée. Le choix du café filtre repose sur des critères
structurels — panier moyen élevé, pas de produit électrique donc pas de
conformité CE lourde, fournisseurs européens disponibles, achat identitaire
avec réachat — et non sur une tendance observée.

**Protocole raisonnable :** dépensez 300 à 500 € de publicité, mesurez votre
CPC et votre conversion réels, puis relancez le modèle :

```bash
npm run economics -- --cpc=0.62 --cr=0.024 --aov=104
```

Tant que ces deux nombres ne sont pas mesurés, ce document est une maquette,
pas une prévision.

---

## Trésorerie

Le besoin en fonds de roulement est le piège silencieux du dropshipping : vous
payez la publicité et la marchandise avant d'être payé, et les virements Stripe
arrivent avec quelques jours de décalage.

Dans le scénario corrigé (173 commandes, 4 325 € de publicité, 29 € de coût
d'achat), le modèle chiffre le besoin à **6 450 €** pour absorber
deux semaines de décalage avec une marge de sécurité. Prévoyez-les avant de
lancer les campagnes, pas après.
