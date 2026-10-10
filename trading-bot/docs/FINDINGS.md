# Ce que la validation a trouvé

Journal des défauts réels découverts en construisant et en testant ce bot. Ils
sont consignés ici pour deux raisons : parce qu'ils expliquent pourquoi le code
est tel qu'il est, et parce que **deux d'entre eux ont une conséquence directe
sur la façon dont tu dois tester dans MetaTrader**.

Les quatre premiers sont corrigés dans le code livré.

---

## 1. Le stop était mesuré sur la mauvaise unité de temps

**Sévérité : erreur de conception. La stratégie ne faisait pas ce que sa propre
spécification annonçait.**

L'ATR qui détermine la distance de stop et la taille de position était calculé
sur l'unité de temps du signal (H4). Mesure :

```
ATR(14) médian en H4 : 0,4725
ATR(14) médian en D1 : 1,3358
rapport D1/H4        : 2,83x
```

Un stop de `3 × ATR(H4)` ne valait donc que **1,06 × ATR(D1)**, là où un suivi
de tendance se place classiquement à 2–4 × ATR(D1).

Conséquence mesurée sur 6 000 bougies :

| ATR du stop | Trades | Durée moyenne | Sorties |
|---|---|---|---|
| H4 (avant) | 75 | **2,8 jours** | stop 74, canal inverse **0** |
| D1 (après) | 35 | **12,0 jours** | canal inverse 34, stop 0 |

Deux choses à la fois : une détention de 2,8 jours n'est pas du suivi de
tendance mais de la cassure court terme — c'est-à-dire le régime où les coûts
de transaction dominent ; et la sortie sur canal inverse ne se déclenchait
**jamais**, donc un tiers de la logique de sortie était du code mort.

**Correctif** : nouveau paramètre `InpStopTF` (défaut `PERIOD_D1`), qui sépare
l'ATR du stop de l'ATR des filtres d'entrée.

---

## 2. Mon générateur de données synthétiques dérivait vers le haut

**Sévérité : invalidait tout test sur données synthétiques.**

Un mouvement brownien géométrique à dérive **log** nulle a une dérive de
**prix** positive : `E[S_t] = S_0 · exp(σ²t/2)`. Mon marché « aléatoire »
montait donc tout seul, et une stratégie à biais long en captait une partie
sans aucun avantage réel.

```
attendu   exp(σ²t/2) sur 2,74 ans à 30% de vol : +13,12%
mesuré    rendement de prix moyen (300 tirages) :  +9,34%
après correction                                :  -3,34% +/- 2,92
```

**Correctif** : retrait de `σ²/2` de la dérive log, pour que le **prix** soit une
martingale. La seule dérive restante est celle qu'on injecte explicitement.

---

## 3. Résolution intra-bougie insuffisante — le plus instructif

**Sévérité : faisait apparaître un avantage là où il est mathématiquement
impossible qu'il y en ait un.**

Même après le correctif n° 2, la stratégie affichait une espérance **positive et
significative** sur une martingale : `E[R] = +0,066 ± 0,008`, soit 8 écarts-types
au-dessus de zéro, sur 18 139 trades. C'est impossible : par le théorème d'arrêt
optionnel, un stop-loss est un temps d'arrêt, donc l'espérance d'une martingale
arrêtée est nulle.

J'ai d'abord cru aux gaps. C'était faux : ajouter des gaps *ajoutait un coût* qui
compensait le biais par coïncidence, sans l'expliquer. Un test de contrôle en
brownien **arithmétique** reproduisait le même biais (`+0,063`), ce qui écartait
aussi la nature multiplicative du GBM.

La vraie cause : mes bougies n'étaient construites que sur **8 pas intra-bougie**,
donc leurs `high`/`low` sous-estimaient l'amplitude du vrai chemin continu. Des
stops qui auraient dû être touchés étaient **manqués**, et les pertes
correspondantes disparaissaient du résultat.

```
 sous-pas  amplitude moy          E[R]            n_trades  % sorties stop
        8         0.790%   +0.0764 +/-0.0292 (2.6sd)   1637           99.2%
       32         0.899%   +0.0095 +/-0.0247 (0.4sd)   1525           99.0%
      128         0.960%   -0.0082 +/-0.0251 (0.3sd)   1446           98.6%
      512         0.991%   -0.0322 +/-0.0246 (1.3sd)   1439           98.6%
     2048         1.006%   -0.0169 +/-0.0255 (0.7sd)   1365           98.8%
```

À 8 sous-pas, l'amplitude enregistrée est inférieure de **21 %** à son
asymptote. Dès 32, l'espérance redevient indiscernable de zéro — ce que la
théorie exige.

**Correctif** : `substeps = 128` par défaut dans `tbdata.synth_bars`.

### Pourquoi ça te concerne directement dans MetaTrader

C'est **exactement** le même biais que les modes de modélisation dégradés du
Strategy Tester. « Prix d'ouverture uniquement » et « 1 minute OHLC » ne
reconstruisent pas le chemin réel à l'intérieur des bougies : ils sous-estiment
donc les amplitudes, **manquent des stops**, et font disparaître des pertes.

Pour une stratégie dont les sorties dépendent du `low` et du `high` — ce qui est
le cas de celle-ci — ce biais va dans le sens flatteur et peut atteindre
plusieurs dixièmes de R par trade, soit largement de quoi transformer une
stratégie perdante en stratégie gagnante à l'écran.

**Conséquence pratique : utilise « Chaque tick selon les ticks réels », toujours.**
Un backtest en « 1 minute OHLC » qui est rentable n'est pas une information. Si
tu veux mesurer l'ampleur du biais chez toi, lance le même backtest dans les deux
modes et compare la perte moyenne en R : l'écart est le biais.

---

## 4. Un paramétrage incohérent désactivait tout le trading, en silence

**Sévérité : faible en conséquence, élevée en frustration.**

Le test de sizing à 2 % de risque par trade ne produisait aucun trade. Cause :
le plafond de risque par groupe valait 1,5 % par défaut. La condition
`risque_cumulé + risque_prévu > plafond` était donc vraie dès la première
entrée, **même avec zéro position ouverte**. Aucun trade n'était jamais pris.

Mon message d'avertissement était lui aussi faux : il annonçait « une seule
position par groupe sera possible » alors qu'il y en avait **zéro**.

**Correctif** : l'EA échoue maintenant à l'initialisation avec un message
explicite, au lieu de tourner sans rien faire. Le harness Python refuse de
démarrer de la même façon.

---

## 5. Ce que la validation n'a PAS pu établir

Pour être complet sur ce qui reste ouvert :

| Point | État |
|---|---|
| Le MQL5 compile | **Non vérifié.** Pas de MetaEditor sous Linux. Vérifications statiques faites : blocs équilibrés, aucune fonction morte, ASCII pur, chaînes de format contrôlées une par une. Les noms d'API restent à valider par le compilateur. |
| Méthode de lissage de l'ATR de MT5 | **Incertain.** Je crois que c'est une SMA du True Range et c'est le défaut retenu, sans avoir pu le vérifier. Procédure de 5 minutes pour trancher : VALIDATION.md étape 2. |
| Rentabilité sur l'or, l'argent, BTC, ETH | **Non mesurée.** Aucune donnée de marché accessible depuis la session (politique réseau). C'est ce que tu mesures aux étapes 4 à 7 de VALIDATION.md, avec les données de ton broker — qui sont de toute façon la meilleure source. |
| Corrélations réelles du panier | **Non mesurées.** Les chiffres cités (or/argent 0,7–0,8 ; BTC/ETH >0,8) viennent de ma connaissance générale et sont approximatifs. `--correlations` les mesure sur tes données. |
| Swaps réels du broker | **Inconnus.** Déterminants pour la crypto. `--cost-sensitivity` donne le seuil ; les spécifications du symbole donnent le taux. |

---

## Ce que ces quatre défauts ont en commun

Aucun n'était un bug de syntaxe, et aucun n'aurait fait planter le programme.
Trois des quatre rendaient les résultats **meilleurs** qu'ils n'étaient — le
sens dans lequel les bugs de backtest penchent presque toujours, parce qu'on
cesse de chercher quand le chiffre devient satisfaisant.

C'est pour ça que le protocole de VALIDATION.md insiste sur des tests qui
peuvent **échouer** (espérance nulle sur une martingale, invariance par
troncature de l'historique, plateau contre pic) plutôt que sur des mesures de
performance. Un backtest rentable n'est pas une preuve ; c'est une hypothèse qui
n'a pas encore été attaquée correctement.
