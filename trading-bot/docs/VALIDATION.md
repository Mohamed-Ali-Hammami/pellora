# Protocole de validation

Pour ce que la validation a déjà trouvé et corrigé, et ce qui reste ouvert :
[FINDINGS.md](FINDINGS.md).

L'ordre compte. Chaque étape peut tuer la stratégie, et il vaut mieux qu'elle
meure à l'étape 2 qu'après trois mois de démo. Ne passe pas à l'étape suivante
si la précédente n'est pas franchie.

---

## Étape 0 — Installation

1. Dans MT5 : **Fichier → Ouvrir le dossier de données**.
2. Copier `mql5/Experts/TrendBasket.mq5` dans `MQL5/Experts/`.
3. Ouvrir MetaEditor (F4), ouvrir le fichier, **compiler** (F7).

### Ce que je n'ai pas pu vérifier

**Je n'ai pas compilé ce code.** MetaEditor n'existe que sous Windows et je
tourne sous Linux. Le fichier a passé les vérifications que je pouvais faire
sans compilateur :

- accolades, parenthèses et crochets équilibrés ;
- aucune fonction définie mais jamais appelée ;
- ASCII pur (pas de problème d'encodage dans MetaEditor) ;
- chaînes de format vérifiées une par une (nombre de spécificateurs = nombre
  d'arguments), et toute précision dynamique `%.*f` remplacée par
  `DoubleToString`, dont la signature ne prête pas à ambiguïté.

Ce que ça ne garantit pas : qu'aucun nom d'API ne soit erroné. J'ai utilisé
`CTrade`, `iATR`, `iMA`, `CopyBuffer`, `CopyHigh`, `CopyLow`, `iClose`,
`iTime`, `OrderCalcMargin`, `SymbolInfoDouble/Integer`, `GlobalVariable*` —
toutes des fonctions que je crois correctes, mais **il faut compiler pour en
être sûr**. S'il reste des erreurs, envoie-moi la sortie de MetaEditor et je
corrige.

---

## Étape 1 — Vérifier que l'EA ne fait rien de stupide

Avant tout chiffre de performance, vérifier le **comportement**.

Strategy Tester (Ctrl+R) :

| Réglage | Valeur |
|---|---|
| Expert | TrendBasket |
| Symbole | XAUUSD (un seul, pour commencer) |
| Période | H4 |
| Modélisation | **Chaque tick selon les ticks réels** — non négociable, voir ci-dessous |
| Dates | 1 an |
| Dépôt | 100 000 |
| `InpSymbols` | `XAUUSD` seulement |

### Pourquoi « ticks réels » et rien d'autre

Les modes « 1 minute OHLC » et « Prix d'ouverture uniquement » ne reconstruisent
pas le chemin du prix à l'intérieur des bougies. Ils sous-estiment donc les
amplitudes, **manquent des stops**, et font disparaître des pertes.

Ce n'est pas théorique : j'ai mesuré ce biais exact dans mon propre générateur
de données. En passant de 8 à 128 pas intra-bougie, l'espérance par trade est
passée de **+0,076 R** (apparemment rentable) à **−0,008 R** (nulle, ce qui est
la valeur correcte sur une martingale). Chiffres complets dans
[FINDINGS.md](FINDINGS.md) § 3.

Cette stratégie sort par le `low` et le `high` : elle est donc précisément du
type que ce biais flatte. **Un backtest en « 1 minute OHLC » qui est rentable
n'est pas une information.** Si tu veux mesurer l'ampleur du biais chez toi,
lance le même backtest dans les deux modes et compare la perte moyenne en R.

### Contrôle visuel

Lancer en mode **Visuel** et regarder le graphique. À contrôler :

- [ ] Les entrées se font bien sur cassure d'un plus-haut/plus-bas de 60 bougies,
      pas au milieu d'un range.
- [ ] Un stop-loss est visible dès l'ouverture de chaque position.
- [ ] Le stop **monte** sur un long gagnant et ne redescend **jamais**.
- [ ] Aucune position opposée simultanée sur le même symbole.
- [ ] L'onglet *Journal* ne contient pas d'erreur répétée.
- [ ] **La durée moyenne de détention dépasse une semaine.** Si elle tombe à
      2–3 jours, le stop est trop serré pour du suivi de tendance : vérifie que
      `InpStopTF` vaut bien `PERIOD_D1` et non `PERIOD_H4`. C'est le défaut qui
      a été trouvé et corrigé pendant la construction ([FINDINGS.md](FINDINGS.md) § 1).
- [ ] **Les deux types de sortie apparaissent** dans le journal (`SORTIE canal
      inverse` et des stops touchés). Si une seule apparaît, un tiers de la
      logique de sortie est du code mort.

Si le journal dit `entree REFUSEE - lot requis ... < minimum broker`, c'est le
mécanisme voulu : le risque demandé est trop petit pour le stop. Soit tu
augmentes le capital, soit tu retires l'instrument.

Si l'EA ne prend **aucun** trade, vérifie dans l'ordre : nom du symbole
(`InpSymbolSuffix`), historique téléchargé en D1 (le filtre de régime exige
200 bougies journalières), et les messages d'erreur de l'initialisation.

---

## Étape 2 — Résoudre l'incertitude sur l'ATR

**C'est un point à trancher, pas à supposer.**

Le harness Python propose deux lissages de l'ATR (`--atr-method sma|wilder`).
Je crois que l'indicateur ATR intégré de MT5 utilise une **moyenne mobile
simple du True Range**, et c'est le défaut retenu — mais **je n'ai pas pu le
vérifier**. Si le choix est faux, le harness et l'EA ne calculent pas la même
taille de position, et toute comparaison entre les deux est bancale.

Comment trancher en cinq minutes :

1. Sur un graphique XAUUSD H4, ajouter l'indicateur **ATR période 14**.
2. Relever la valeur affichée sur 3 bougies closes précises (Ctrl+Y pour voir
   les valeurs exactes dans la fenêtre de données).
3. Exporter ces bougies en CSV (étape 4) et lancer :
   ```
   python3 -c "
   import tbdata, tbcore, sys
   df = tbdata.load_mt5_csv('data/XAUUSD.csv')
   for m in ('sma','wilder'):
       print(m, tbcore.atr_series(df, 14, m).tail(3).round(5).to_list())
   "
   ```
4. La méthode qui reproduit les valeurs de MT5 est la bonne. Mets-la en défaut
   dans `Params.atr_method` (`research/tbcore.py`).

---

## Étape 3 — Diversification réelle du panier

```
python3 backtest.py --data ./data --correlations
```

Le script affiche la matrice de corrélation et le **nombre de paris
indépendants équivalents** (via les valeurs propres de la matrice).

**Critère.** Si le nombre de paris effectifs est inférieur à ~60 % du nombre
d'instruments, le panier est moins diversifié qu'il n'y paraît. Ce n'est pas
bloquant, mais ça te dit que la variabilité des résultats sera élevée — et que
le meilleur investissement n'est pas un réglage de paramètre, c'est d'ajouter
des instruments décorrélés.

---

## Étape 4 — Exporter les données du broker

C'est **la bonne source de données** : ce sont les prix et les spreads que tu
vas réellement subir.

1. MT5 → **Affichage → Symboles** (Ctrl+U).
2. Choisir le symbole, onglet **Barres**, période **H4**, plage de dates la plus
   longue disponible, puis **Exporter les barres**.
3. Enregistrer en `research/data/XAUUSD.csv` (le nom de fichier sert de nom de
   symbole). Répéter pour chaque instrument.

Le loader accepte le format d'export MT5 (`<DATE> <TIME> <OPEN> ...`,
tabulations) et convertit la colonne `<SPREAD>`, exprimée en points, en unités
de prix.

**Avant de continuer**, corrige `DEFAULT_SPECS` dans `research/backtest.py` :
les tailles de contrat et lots minimums par défaut sont des conventions
courantes, **pas les spécifications de ton broker**. Relève les tiennes par
clic droit sur le symbole → *Spécification*. Une taille de contrat fausse rend
les contraintes de lot minimum et les coûts de portage faux.

---

## Étape 5 — Le test des coûts de portage

```
python3 backtest.py --data ./data --cost-sensitivity
```

Le script balaye les taux de financement et affiche le **taux de rupture** :
celui au-delà duquel la stratégie perd de l'argent.

Ensuite, relève tes swaps réels : clic droit sur le symbole → *Spécification* →
`Swap long` / `Swap short`, et convertis en pourcentage annuel du notionnel.

**Critère de rejet.** Si le swap réel d'un instrument dépasse le taux de
rupture, cet instrument sort du panier. C'est particulièrement probable sur les
CFD crypto. La bonne réaction est de le retirer, **pas** d'ajuster les
paramètres jusqu'à ce que le backtest redevienne présentable.

---

## Étape 6 — Plateau ou pic ?

```
python3 backtest.py --data ./data --param-scan
```

**C'est le test le plus important du protocole**, parce qu'il détecte le mode
d'échec le plus fréquent : la stratégie qui n'a jamais eu d'edge, seulement un
réglage flatteur.

On ne cherche **pas** la meilleure case. On cherche une **large zone contiguë**
où tout fonctionne à peu près, et on se place en son centre.

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| Une majorité de la grille positive, variation douce entre voisins | Plateau. Il y a peut-être quelque chose. Prends le centre. |
| Quelques cases excellentes, voisines mauvaises | Pic. Bruit ajusté. Ne mets pas ça en démo. |
| Grille majoritairement négative avec un bon maximum | Pas d'edge. Le maximum est un artefact. |

**Critère.** Je propose : au moins 60 % des combinaisons positives, et le réglage
retenu entouré de voisins également positifs. C'est un seuil que je propose, pas
un standard de l'industrie — ajuste-le, mais fixe-le **avant** de voir les
résultats, sinon il ne sert à rien.

---

## Étape 7 — Hors échantillon

```
python3 backtest.py --data ./data --walk-forward 5
```

Les paramètres sont optimisés sur le passé, puis mesurés sur la période
suivante, qu'ils n'ont jamais vue. C'est la seule mesure qui ressemble à ce que
vivra le bot en démo.

**Trois signaux d'alarme :**

1. CAGR hors échantillon très inférieur au CAGR in-sample → l'optimisation
   capturait du bruit. C'est le cas le plus fréquent, et ce n'est pas un échec
   du protocole : c'est le protocole qui fonctionne.
2. Paramètres retenus qui **sautent** d'une fenêtre à l'autre → il n'existe pas
   de réglage stable. Mauvais signe même si le résultat est bon.
3. Moins de la moitié des fenêtres positives → ne mets pas ça en démo en
   espérant mieux.

**Critère que je propose, à fixer avant de regarder :**

| Mesure | Seuil |
|---|---|
| Fenêtres OOS positives | ≥ 60 % |
| CAGR OOS moyen | > 0, et ≥ 40 % du CAGR in-sample |
| Drawdown max OOS | ≤ 1,5 × le drawdown in-sample |
| Nombre de trades OOS | ≥ 30 (sinon le résultat n'a aucune signification statistique) |

Ce dernier point est souvent décisif : avec 4 instruments en suivi de tendance,
tu génères peu de trades. Si tu n'as pas 100+ trades sur l'ensemble du backtest,
**tu ne mesures rien** — tu regardes du bruit, et ni le Sharpe ni le taux de
réussite ne veulent dire quoi que ce soit.

---

## Étape 8 — Démo

Seulement si les étapes 5 à 7 sont franchies.

**Réglages :** capital 100 000, `InpRiskPctPerTrade = 1.0`, panier réduit aux
instruments qui ont survécu à l'étape 5.

**Attacher l'EA à un graphique BTCUSD** (ou tout instrument coté 24/7) plutôt
qu'à l'or : `OnTick` ne se déclenche que sur les ticks du symbole du graphique.
Un timer interne couvre ce cas, mais un graphique 24/7 reste plus sûr.

Autoriser le trading algorithmique (bouton *Algo Trading*), vérifier que le
journal *Experts* affiche la ligne d'initialisation avec le bon univers.

### Durée minimale

**Au moins 6 mois**, ou 50 trades, le plus long des deux. En dessous, tu ne peux
pas distinguer la stratégie du hasard. C'est frustrant, et c'est comme ça : avec
40 % de trades gagnants, une série de 8 pertes consécutives arrive régulièrement
sans que rien ne soit cassé.

### Ce qu'il faut comparer, et c'est le vrai but de la démo

Ne regarde pas d'abord le profit. Compare la démo au backtest sur la même
période :

| Mesure | Ce qu'un écart signifie |
|---|---|
| Nombre de trades | Très inférieur → un filtre bloque plus qu'en backtest (spread, lot minimum). Lis le journal. |
| Slippage à l'entrée | Supérieur au backtest → le modèle de coûts est optimiste. |
| Perte moyenne en R | Pire que −1,0 → les stops sont traversés par des gaps. Risque réel > risque calculé. |
| Durée moyenne | Très différente → l'ATR ou le trailing ne se comportent pas comme simulé. |

Un écart important sur n'importe laquelle de ces lignes invalide le backtest
**plus sûrement** qu'un mauvais résultat de profit, parce qu'il montre que la
simulation et la réalité ne décrivent pas le même système.

### Critère d'arrêt, à fixer maintenant

Écris-le avant de commencer, parce que tu ne le fixeras pas honnêtement une fois
en perte :

- Drawdown > 15 % → arrêt et analyse, pas d'ajustement de paramètre en cours de
  route.
- Perte moyenne en R nettement pire que −1,0 → le modèle de risque est faux,
  arrêt.
- 3 mois sans trade → les filtres sont trop serrés pour ce panier, arrêt.

---

## Étape 9 — Avant tout argent réel

Ce document ne couvre pas le passage en réel, et il y a une raison : une
stratégie validée jusqu'ici a démontré qu'elle n'est pas absurde, **pas**
qu'elle est rentable. Les trois choses qui changent en réel et qu'aucun test
ci-dessus ne capture :

1. **Ton comportement.** Désactiver le bot après trois pertes est le mode
   d'échec le plus courant des systèmes automatisés, et il n'apparaît dans
   aucun backtest.
2. **Le slippage en conditions de stress.** Les ticks réels du Strategy Tester
   ne contiennent pas les élargissements de spread que tu subiras lors d'un
   mouvement violent.
3. **Le risque de contrepartie.** Exécution, requotes, conditions modifiées par
   le broker.
