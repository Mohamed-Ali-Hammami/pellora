# Ce qu'il faut pour 5 000 € par mois

Ce document répond par le calcul, pas par une promesse. Tous les chiffres
viennent de `npm run economics`, que vous pouvez relancer avec vos propres
hypothèses en éditant `baselineInputs` dans `src/lib/economics.ts`.

> **Les deux nombres qui décident de tout — le coût par clic et le taux de
> conversion — sont des hypothèses, pas des mesures.** Je n'ai pas de source
> vérifiée pour cette niche à la date d'aujourd'hui. Remplacez-les par vos
> propres données dès vos premiers 500 à 1 000 € de publicité. Tant qu'ils ne
> sont pas mesurés, ce document est une maquette, pas une prévision.

---

## L'identité qui décide de tout

```
CAC = CPC / taux de conversion
```

Le coût d'acquisition d'un client est le coût par clic divisé par le taux de
conversion. Un CPC de 1,40 € avec 0,60 % de conversion donne **233 € pour
obtenir une commande**. Aucune astuce de site ne contourne cette division. On
ne peut agir que sur trois choses : le CPC (ciblage, créas), la conversion
(fiche produit, prix, réassurance) et la marge par commande (panier moyen,
coût d'achat).

---

## Ce que cette niche a de particulier

Un panier à quatre chiffres change tout le raisonnement par rapport à un
produit d'impulsion :

| | Produit d'impulsion | Poêle à granulés |
|---|---|---|
| Panier moyen | 50 à 100 € | **1 500 à 2 500 €** |
| Marge par commande | 20 à 40 € | **250 à 350 €** |
| Taux de conversion | 1,5 à 3 % | **0,4 à 1,2 %** |
| Coût par clic | 0,40 à 0,90 € | **1,00 à 2,00 €** |
| Décision d'achat | immédiate | **plusieurs semaines** |
| Coût d'un retour | 5 à 15 € | **90 à 180 €** |

On n'achète pas un poêle à 2 000 € à la première visite : on compare, on
demande un devis d'installation, on revient. Le taux de conversion est donc
structurellement bas, et le CPC élevé parce que les installateurs et les
grandes enseignes enchérissent sur les mêmes mots-clés.

La contrepartie est que la marge par commande est confortable, donc le CAC
supportable est élevé — là où un produit à 80 € ne peut pas payer 35 € de
publicité, un poêle à 1 900 € peut en payer 230.

---

## La marge réelle sur une commande de 1 900 €

| Poste | Montant |
|---|---|
| Encaissé TTC | 1 900,00 € |
| TVA reversée (÷ 1,20) | −316,67 € |
| **Chiffre d'affaires HT** | **1 583,33 €** |
| Coût d'achat marchandise | −1 180,00 € |
| Port payé au fournisseur | −68,00 € |
| Frais de paiement (1,5 % + 0,25 €) | −28,75 € |
| Provision retours (3 %) | −11,24 € |
| **Marge avant publicité** | **295,35 €** |
| Marge brute | **25,5 %** |

C'est **le plafond absolu du coût d'acquisition**. Au-delà de 295 € pour
obtenir une commande, chaque vente supplémentaire creuse la perte.

---

## Le compte à l'arrivée

Avec les hypothèses de départ (CPC 1,40 €, conversion 0,60 %) :

| | |
|---|---|
| CAC impliqué | **233,33 €** |
| CAC maximal avant perte | 295,35 € |
| **Marge après publicité, par commande** | **62,01 €** |
| Commandes nécessaires pour 5 000 € / mois | **90** (3 par jour) |
| Visites nécessaires | **15 000 / mois** |
| Budget publicitaire | **21 000 € / mois** |
| Chiffre d'affaires | 171 000 € / mois |
| **Marge nette** | **2,95 %** |

**C'est la ligne la plus importante du document.** Pour dégager 5 000 € de
bénéfice, il faut encaisser 171 000 € et dépenser 21 000 € de publicité. La
marge nette est de 3 %. Un modèle à 3 % ne pardonne aucune erreur : un CPC qui
passe de 1,40 € à 1,80 € fait basculer l'ensemble en perte.

---

## La trésorerie, qui tue plus de boutiques que la marge

**Environ 88 000 €** de trésorerie sont nécessaires pour tenir le décalage
entre la dépense publicitaire, le paiement du fournisseur et l'encaissement —
soit environ 14 jours de dépenses avec un coefficient de sécurité de 1,5.

Ce nombre est le plus souvent ignoré dans les présentations du dropshipping, et
c'est pourtant lui qui arrête la plupart des projets : la publicité se paie
immédiatement, le fournisseur avant expédition, et le virement client arrive sous un à plusieurs
jours. Sur un panier à quatre chiffres, le besoin en fonds de roulement est
plusieurs fois supérieur au bénéfice annuel visé.

---

## Les quatre leviers, par ordre d'effet

Bénéfice mensuel à 90 commandes, un paramètre à la fois :

**Taux de conversion** — le levier le plus brutal.

| | |
|---|---|
| 0,40 % | −5 459 € |
| **0,60 %** | **+5 041 €** |
| 0,80 % | +10 291 € |
| 1,20 % | +15 541 € |

**Coût par clic** — symétrique, et subi plutôt que choisi.

| | |
|---|---|
| 0,80 € | +14 041 € |
| **1,40 €** | **+5 041 €** |
| 1,80 € | −959 € |
| 2,40 € | −9 959 € |

**Panier moyen** — le levier qu'on contrôle vraiment.

| | |
|---|---|
| 1 500 € | −23 535 € |
| **1 900 €** | **+5 041 €** |
| 2 200 € | +26 473 € |
| 2 600 € | +55 049 € |

**Coût d'achat** — d'où l'importance de la négociation fournisseur.

| | |
|---|---|
| 1 000 € | +20 755 € |
| **1 180 €** | **+5 041 €** |
| 1 280 € | −3 689 € |

---

## Ce que ces tableaux disent, en une phrase

Les deux lignes qui décident de tout — conversion et CPC — **ne se décrètent
pas, elles se mesurent**. Les deux que vous contrôlez — panier moyen et coût
d'achat — sont donc les seules sur lesquelles travailler avant d'avoir dépensé
un euro de publicité :

1. **Négociez le coût d'achat.** 100 € gagnés à l'achat valent plus que 200 €
   gagnés au prix de vente, parce qu'ils n'affectent pas la conversion.
2. **Montez le panier moyen** par la vente croisée : le conduit, le thermostat
   et la première palette de granulés se vendent avec l'appareil, et leur
   marge relative est meilleure.
3. **Ne vendez pas un appareil surdimensionné.** Un retour coûte 90 à 180 € de
   transport, plus le risque d'avarie — soit la moitié de la marge de la
   commande. C'est la raison économique, et pas seulement déontologique, du
   calculateur de puissance.

---

## Relancer le calcul avec vos chiffres

```bash
npm run economics
```

Pour modifier les hypothèses : `baselineInputs` dans `src/lib/economics.ts`.
Les tests de `tests/economics.test.ts` vérifient que le modèle reste cohérent —
notamment qu'il ne propose jamais « plus de volume » pour sauver une marge
négative, qui est le piège central du dropshipping.
