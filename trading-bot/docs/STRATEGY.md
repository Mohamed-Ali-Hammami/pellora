# Stratégie « Trend Basket » — spécification

> Document de conception. Ce qui est écrit ici est ce que le code implémente.
> Ce qui relève d'une hypothèse non vérifiée est marqué **[HYPOTHÈSE]**.
> Ce que je n'ai pas pu mesurer est marqué **[NON MESURÉ]**.

---

## 1. Thèse

La stratégie exploite le **time-series momentum** (ou suivi de tendance) : la
tendance d'un actif sur plusieurs semaines a historiquement eu une autocorrélation
positive, c'est-à-dire qu'un actif qui monte depuis deux mois a eu une probabilité
légèrement supérieure à 50 % de continuer à monter le mois suivant.

**Base empirique.** Les deux références que j'ai en tête sont :

- Moskowitz, Ooi & Pedersen, « Time Series Momentum », *Journal of Financial
  Economics* 104(2), 2012.
- Hurst, Ooi & Pedersen, « A Century of Evidence on Trend-Following Investing »,
  AQR Capital Management.

Je cite ces deux titres **de mémoire**. Ils correspondent à ma connaissance de la
littérature, mais je n'ai pas pu les consulter depuis cette session (accès réseau
restreint). **Vérifie-les avant de t'appuyer dessus** : titres, auteurs, revue et
surtout les chiffres qu'ils rapportent.

**Pourquoi cette thèse plutôt qu'une autre.** Ce n'est pas qu'elle soit la plus
rentable. C'est qu'elle est :

1. **Documentée hors échantillon** — publiée, puis testée par d'autres sur
   d'autres périodes et d'autres marchés. La plupart des stratégies retail n'ont
   jamais existé ailleurs que dans le backtest de leur auteur.
2. **Pauvre en paramètres** — 6 paramètres de signal. Le surapprentissage est la
   première cause de mort des bots retail : une stratégie à 30 paramètres trouve
   toujours une combinaison magnifique sur le passé.
3. **Robuste à l'exécution** — elle décide sur bougies H4 closes. Un retard de
   200 ms ou un slippage d'un tick ne change rien. L'écart entre le backtest et
   le réel reste donc petit, ce qui n'est pas vrai du scalping.
4. **Asymétrie favorable** — pertes bornées par un stop, gains laissés courir.
   Beaucoup de petites pertes, peu de gros gains. C'est l'inverse du profil
   grid/martingale, qui affiche 95 % de trades gagnants et se ruine sur le 5 %.

### Ce que je n'ai pas retenu, et pourquoi

| Approche | Pourquoi écartée |
|---|---|
| Grid / martingale / averaging down | Expectancy positive en backtest, risque de ruine structurel. Le backtest ne montre la ruine que si la période contient le mouvement qui la provoque. |
| Scalping / HFT | Sur CFD retail, le spread et la commission dépassent l'edge attendu. Non viable à ce niveau d'infrastructure. |
| Réseaux de neurones sur prix brut | Rapport signal/bruit des prix trop faible, surapprentissage quasi certain, et un modèle qu'on ne peut pas déboguer quand il perd. Éventuellement un filtre plus tard, jamais le moteur. |
| Arbitrage de news / sentiment | Demande une latence et des flux de données hors de portée ici. |

---

## 2. Univers

| Symbole (nom broker typique) | Groupe de corrélation |
|---|---|
| XAUUSD — or | `METALS` |
| XAGUSD — argent | `METALS` |
| BTCUSD — bitcoin | `CRYPTO` |
| ETHUSD — ethereum | `CRYPTO` |

**[HYPOTHÈSE — importante]** Ce panier est **faiblement diversifié**. Or/argent
sont historiquement corrélés autour de 0,7–0,8 ; BTC/ETH souvent au-delà de 0,8.
Ces chiffres sont approximatifs et varient fortement selon la période — **à
mesurer sur tes propres données** (le harness Python le fait, voir
`research/backtest.py --correlations`).

Conséquence concrète : avec 4 positions ouvertes, tu n'as pas 4 paris mais
environ **2 paris de taille double**. Le suivi de tendance tire l'essentiel de
son ratio de Sharpe du nombre de paris indépendants : un CTA institutionnel en
trade 50 à 100. À 2, la volatilité des résultats est bien plus élevée et les
périodes de perte bien plus longues.

C'est pour ça que le code impose un **plafond de risque par groupe** (§5) : sans
lui, un retournement simultané de l'or et de l'argent frappe comme une seule
position de taille double.

**Recommandation que je maintiens** : ajouter les paires forex majeures
(EURUSD, GBPUSD, USDJPY, AUDUSD, USDCHF, USDCAD) ferait passer le panier de 2 à
~5 paris quasi indépendants, pour un coût de transaction plus faible que la
crypto. L'univers est un simple paramètre d'entrée (`InpSymbols`) : tu peux les
ajouter sans toucher au code.

---

## 3. Signal

Tout est évalué **sur bougie close uniquement**. L'EA ne regarde jamais la bougie
en cours pour décider. C'est la règle qui élimine le look-ahead et le repainting.

### 3.1 Filtre de régime (D1)

```
regime_long  =  close[D1,1] > EMA(200)[D1,1]
regime_short =  close[D1,1] < EMA(200)[D1,1]
```

Seules les entrées dans le sens du régime sont autorisées. Objectif : ne pas
prendre de breakout haussier dans un marché baissier structurel, là où les faux
signaux se concentrent.

### 3.2 Entrée (H4) — breakout de canal de Donchian

```
canal_haut = max(high[H4, 2 .. N+1])     N = InpDonchianEntry, défaut 60
canal_bas  = min(low [H4, 2 .. N+1])

LONG  si  regime_long  et  close[H4,1] > canal_haut
SHORT si  regime_short et  close[H4,1] < canal_bas
```

Note sur les index : on compare la bougie close `[1]` à un canal calculé sur les
bougies `[2 .. N+1]`, donc la bougie de signal est **exclue** de son propre
canal. C'est volontaire : l'inclure rendrait la condition presque toujours vraie
sur un nouveau plus-haut.

N = 60 bougies H4 ≈ 10 jours calendaires de marché continu.

### 3.3 Filtres de rejet

Une entrée valide est quand même refusée si :

| Filtre | Règle | Raison |
|---|---|---|
| Choc de volatilité | `ATR(14)[H4] > InpAtrSpikeMult × médiane(ATR, 100)` (défaut 2,5) | Entrer dans un pic de volatilité, c'est payer un stop très large sur un mouvement souvent déjà terminé. |
| Spread | `spread_courant > InpMaxSpreadAtrFrac × ATR` (défaut 0,08) | Garde-fou essentiel sur CFD crypto, où le spread s'élargit brutalement le week-end et sur news. |
| Position déjà ouverte | 1 position max par symbole | Pas d'empilement : c'est de l'averaging déguisé. |
| Plafond de groupe | voir §5 | |
| Coupe-circuit | voir §5 | |

---

## 4. Sortie

**Pas de take-profit fixe.** C'est un choix structurel, pas un oubli. Le suivi de
tendance est rentable *grâce à* la queue droite de sa distribution : quelques
trades qui courent très loin paient toutes les petites pertes. Couper à 2×R
supprime exactement la partie qui finance la stratégie.

Trois sorties, la première atteinte s'applique :

1. **Stop initial** — `entrée − k × ATR(14)[D1]`, k = `InpAtrStopMult` (défaut 3,0),
   symétrique en short. Posé comme un vrai SL côté broker, donc actif même si le
   terminal se déconnecte.

   **L'ATR du stop est mesuré en D1, pas en H4** — c'est le paramètre
   `InpStopTF`, et ce n'est pas un détail. Mesure faite sur ce projet :
   `ATR(14)[D1] / ATR(14)[H4] = 2,83`. Un stop de 3 × ATR(H4) ne vaut donc que
   ~1,06 × ATR(D1), alors qu'un suivi de tendance se place classiquement à
   2–4 × ATR(D1). Avec l'ATR H4, la durée de détention mesurée tombait à
   **2,8 jours** et la sortie sur canal inverse ne se déclenchait **jamais**
   (105 sorties sur 106 par le stop) : ce n'était plus du suivi de tendance mais
   un système de cassure court terme, c'est-à-dire le régime où les coûts
   dominent. Avec l'ATR D1 : **12 jours** de détention et les deux sorties
   actives.

2. **Stop suiveur « chandelier »** — recalculé sur chaque bougie H4 close :
   ```
   long  :  SL = max(SL_actuel, plus_haut_depuis_entrée − k × ATR[D1])
   short :  SL = min(SL_actuel, plus_bas_depuis_entrée  + k × ATR[D1])
   ```
   **À cliquet uniquement** : le stop ne se desserre jamais. Un stop qu'on
   recule est un stop qui n'existe pas.

3. **Sortie Donchian inverse** — clôture si `close[H4,1]` casse le canal opposé
   sur `InpDonchianExit` bougies (défaut 30, soit N/2).

**Qui sort quoi, en pratique.** Avec un stop à 3 × ATR(D1), c'est le **canal
inverse qui devient la sortie principale** et le stop qui devient un filet de
sécurité contre un mouvement violent. C'est la structure du système Turtle
classique (entrée sur cassure, sortie sur canal opposé moitié plus court, stop
large à 2N) et c'est voulu : le canal sort proprement d'une tendance qui
s'essouffle, le stop ne sert qu'au désastre.

---

## 5. Risque

### 5.1 Taille de position

```
risque_€        = equity × InpRiskPctPerTrade / 100        (1 % → 1 000 € sur 100 k)
distance_stop   = k × ATR(14)[H4]                          en unités de prix
valeur_par_lot  = SYMBOL_TRADE_TICK_VALUE_LOSS / SYMBOL_TRADE_TICK_SIZE
lots            = risque_€ / (distance_stop × valeur_par_lot)
```

Puis arrondi **au pas de volume inférieur** (`SYMBOL_VOLUME_STEP`).

**Point de correction important** : si le lot calculé tombe **sous**
`SYMBOL_VOLUME_MIN`, le trade est **refusé**, pas arrondi au lot minimum. C'est
une erreur fréquente dans les EA retail : arrondir à 0,01 lot quand le calcul
donne 0,003 multiplie le risque réel par 3 sans que rien ne le signale. L'EA
journalise le refus.

Conséquence du sizing par volatilité : la position en lots est **petite quand
l'ATR est grand**. Chaque trade risque le même montant en euros, que ce soit sur
l'or calme ou le bitcoin agité. C'est ce qui rend les instruments comparables
dans un même panier.

### 5.2 Plafonds de portefeuille

| Contrôle | Défaut | Effet |
|---|---|---|
| `InpRiskPctPerTrade` | 1,0 % | Risque par trade |
| `InpGroupRiskCapPct` | 1,5 % | Risque cumulé max par groupe corrélé (`METALS`, `CRYPTO`) |
| `InpPortfolioHeatCapPct` | 4,0 % | Risque cumulé max toutes positions |
| `InpDailyLossStopPct` | 5,0 % | Sous ce recul depuis l'equity d'ouverture du jour : plus aucune entrée jusqu'au lendemain |
| `InpMaxDrawdownStopPct` | 25,0 % | Sous ce recul depuis le pic d'equity : arrêt total des entrées |

Le « risque cumulé » compte, pour chaque position ouverte, la perte qu'elle
infligerait **si son stop actuel était touché** — pas son risque d'origine. Une
position dont le stop suiveur est passé au-dessus du prix d'entrée compte donc
pour 0 (ou pour un gain), et libère de la place pour une nouvelle entrée. C'est
le comportement correct : le risque réel est celui du stop courant.

**[NON MESURÉ]** Ces cinq valeurs par défaut sont des choix de conception
prudents, **pas des optima mesurés**. Le plafond de drawdown à 25 % en
particulier est un garde-fou arbitraire : il n'empêche pas une perte de 25 %, il
arrête le bot après.

### 5.3 Ce que la gestion du risque ne fait pas

- Elle ne protège pas d'un **gap**. Un stop à 3 ATR sur BTCUSD peut être traversé
  d'un bloc à l'ouverture du dimanche. Le risque réalisé dépasse alors le risque
  calculé. Aucun paramètre ne corrige ça.
- Elle ne protège pas d'un **défaut de broker** ni d'un élargissement extrême du
  spread.
- Le coupe-circuit journalier se mesure **à l'equity**, qui bouge en continu :
  il peut se déclencher sur un creux intraday puis le marché se retourner. C'est
  le prix d'un garde-fou.

---

## 6. Coûts — le point qui peut tuer la stratégie

**[HYPOTHÈSE — à mesurer en priorité]**

Un trade de suivi de tendance tient en moyenne plusieurs semaines. Sur CFD, chaque
nuit de détention coûte un financement (swap). Sur les CFD crypto des brokers
retail, ce coût est souvent **nettement plus élevé** que sur le forex ou les métaux.

Ordre de grandeur de ce qui est en jeu : un financement de 0,03 %/jour sur une
position tenue 30 jours coûte ~0,9 % de la valeur notionnelle. Avec un levier de
10, c'est 9 % du capital engagé — là où le gain brut attendu d'un trade gagnant
de suivi de tendance se compte en quelques pourcents. **Ce calcul est une
illustration, pas une mesure** : je n'ai ni les taux de ton broker, ni les
notionnels réels.

**C'est la question à trancher avant toute mise en démo prolongée :**

1. Relève les swaps réels de ton broker : clic droit sur le symbole dans le
   Market Watch → *Spécification* → lignes `Swap long` / `Swap short`.
2. Lance `research/backtest.py --cost-sensitivity` : il balaye les taux de
   financement et affiche à partir de quel taux l'edge disparaît, par instrument.

Si le résultat montre que la crypto ne survit pas aux coûts, la conclusion
honnête sera de **sortir BTC/ETH du panier**, pas d'ajuster les paramètres
jusqu'à ce que le backtest redevienne joli.

---

## 7. Paramètres et valeurs par défaut

| Paramètre | Défaut | Plage à tester |
|---|---|---|
| `InpDonchianEntry` | 60 | 30 – 120 |
| `InpDonchianExit` | 30 | 15 – 60 |
| `InpAtrPeriod` | 14 | 10 – 20 |
| `InpAtrStopMult` | 3,0 | 2,0 – 5,0 |
| `InpStopTF` | D1 | ne pas mettre en H4 — voir §4 |
| `InpRegimeMaPeriod` | 200 | 100 – 300 |
| `InpAtrSpikeMult` | 2,5 | 2,0 – 4,0 |

**Règle de décision sur ces paramètres.** Le critère n'est pas « quelle
combinaison donne le meilleur résultat ». C'est : **la surface de performance
est-elle un plateau ou un pic ?** Un optimum isolé entouré de résultats mauvais
est du bruit ajusté, et il ne survivra pas en démo. On cherche une large zone
où tout fonctionne à peu près, et on se place au milieu. Voir
[VALIDATION.md](VALIDATION.md).

---

## 8. Performance à attendre

**[HYPOTHÈSE]** Pour fixer les attentes avant de regarder le premier backtest.

Le suivi de tendance diversifié affiche historiquement, sur des portefeuilles
institutionnels larges, un ratio de Sharpe de l'ordre de **0,3 à 0,7**, avec des
drawdowns de **20 à 40 %** et des périodes de stagnation pouvant durer plus d'un
an. Ces ordres de grandeur viennent de ma connaissance de la littérature CTA ;
ils sont **approximatifs et à vérifier auprès d'une source primaire**.

**Quel horizon cette stratégie peut capter.** Le filtre de régime est une
EMA 200 en journalier : il ne peut distinguer que des tendances durant **bien
plus de 200 jours**. Ce n'est pas un réglage mais une conséquence arithmétique,
et elle définit ce que le bot peut gagner. Sur un marché dont la direction
change tous les deux mois, ce filtre a structurellement tort — et aucun autre
paramètre ne compense ça. Si tu veux capter des tendances plus courtes, c'est
`InpRegimeMaPeriod` qu'il faut baisser, en sachant que tu augmentes aussi les
faux signaux.

Sur ce panier précis, attends-toi à **pire** que ces chiffres, pour trois raisons
concrètes : seulement ~2 paris indépendants au lieu de dizaines, des coûts CFD
retail supérieurs aux coûts futures institutionnels, et un historique crypto
court (moins de 10 ans de données exploitables) qui ne couvre qu'un nombre
réduit de cycles.

Profil de trades attendu : **35 à 45 % de gagnants**, avec un gain moyen 2 à 3
fois la perte moyenne. Si un backtest te sort 70 % de gagnants, cherche le bug
ou le look-ahead avant de te réjouir.

**Ce que personne ne peut te dire, moi compris** : si cet edge existe encore sur
la période à venir. Le passé est la seule donnée disponible, et elle ne porte
aucune garantie.
