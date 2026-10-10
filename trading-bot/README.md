# TrendBasket — bot de trading suivi de tendance pour MetaTrader 5

Bot de trading automatisé (Expert Advisor MQL5) sur panier multi-instruments,
accompagné d'un harness de recherche Python pour le valider **avant** de le
mettre en démo.

```
trading-bot/
├── mql5/Experts/TrendBasket.mq5   L'EA (à compiler dans MetaEditor)
├── research/
│   ├── tbcore.py                  Moteur de backtest (même logique que l'EA)
│   ├── tbdata.py                  Chargement CSV MT5 + données synthétiques
│   ├── backtest.py                CLI : corrélations, coûts, balayage, walk-forward
│   ├── test_engine.py             Tests de validation du moteur (34 vérifications)
│   ├── test_parity.py             Vérifie que l'EA et le harness ont les mêmes défauts
│   └── requirements.txt
└── docs/
    ├── STRATEGY.md                Spécification complète et justification
    ├── VALIDATION.md              Protocole de test, étape par étape
    └── FINDINGS.md                Défauts réels trouvés pendant la validation
```

---

## Ce que ce dépôt est, et ce qu'il n'est pas

**Il est** une implémentation complète et testée d'une stratégie de suivi de
tendance, avec une gestion du risque explicite et un protocole pour mesurer si
elle fonctionne.

**Il n'est pas** une machine à gagner de l'argent, et je ne peux pas te dire
s'il en gagnera. Voici précisément ce qui est démontré et ce qui ne l'est pas :

| Affirmation | Statut |
|---|---|
| Le code implémente la spécification sans look-ahead | **Vérifié** — tronquer l'historique ne change rien au passé |
| Le sizing respecte exactement le risque demandé | **Vérifié** — à toutes les valeurs testées |
| Les plafonds de risque et coupe-circuits se déclenchent | **Vérifié** |
| L'espérance est nulle sur une martingale, positive sur un marché à tendances | **Vérifié** — c'est le test qui a trouvé trois bugs |
| Le MQL5 compile | **NON VÉRIFIÉ** — pas de MetaEditor sous Linux |
| La stratégie est rentable sur l'or, l'argent, BTC, ETH | **NON MESURÉ** — données de marché inaccessibles depuis cette session |
| L'edge du suivi de tendance existe encore aujourd'hui | **Inconnaissable** — par personne |

`research/test_engine.py` : **34/34 vérifications passées.** Elles valident le
moteur, pas la rentabilité. Les défauts qu'elles ont trouvés — dont un stop
mesuré sur la mauvaise unité de temps et un biais qui faisait gagner la
stratégie sur une martingale — sont documentés dans
[docs/FINDINGS.md](docs/FINDINGS.md).

---

## Démarrage

### 1. Compiler l'EA

MT5 → *Fichier → Ouvrir le dossier de données* → copier
`mql5/Experts/TrendBasket.mq5` dans `MQL5/Experts/` → F4 (MetaEditor) → F7.

**Je n'ai pas pu compiler ce fichier** : MetaEditor n'existe que sous Windows.
J'ai vérifié ce qui pouvait l'être sans compilateur (équilibrage des blocs,
aucune fonction morte, ASCII pur, chaînes de format contrôlées une par une).
S'il reste des erreurs d'API, envoie-moi la sortie de MetaEditor.

### 2. Valider le moteur de recherche

```bash
cd research
pip install -r requirements.txt
python3 test_engine.py    # 34 vérifications du moteur (~3 min)
python3 test_parity.py    # l'EA et le harness ont-ils les mêmes défauts ?
```

`test_parity.py` existe parce que si l'EA et le harness divergent, le backtest
ne décrit plus le bot qui va trader — et rien ne proteste. Relance-le après
chaque modification de paramètre d'un côté ou de l'autre.

### 3. Backtester dans MT5 — un réglage non négociable

Dans le Strategy Tester, mets la modélisation sur **« Chaque tick selon les
ticks réels »**. Pas « 1 minute OHLC », pas « Prix d'ouverture uniquement ».

Ce n'est pas du zèle. Les modes dégradés ne reconstruisent pas le chemin du prix
à l'intérieur des bougies : ils sous-estiment les amplitudes et **manquent des
stops**, ce qui fait disparaître des pertes. J'ai mesuré ce biais exact dans mon
propre générateur de données : il valait **+0,076 R par trade**, assez pour
transformer une stratégie à espérance nulle en stratégie apparemment rentable.
Le détail et les chiffres : [docs/FINDINGS.md](docs/FINDINGS.md) § 3.

### 4. Exporter tes données et mesurer

```bash
# MT5 → Ctrl+U → symbole → Barres → H4 → Exporter → research/data/XAUUSD.csv

python3 backtest.py --data ./data --correlations        # le panier est-il diversifié ?
python3 backtest.py --data ./data --cost-sensitivity    # les swaps tuent-ils l'edge ?
python3 backtest.py --data ./data --param-scan          # plateau ou pic ?
python3 backtest.py --data ./data --walk-forward 5      # hors échantillon
```

Puis suis [docs/VALIDATION.md](docs/VALIDATION.md), dans l'ordre. Le protocole
est conçu pour que la stratégie puisse **échouer** à une étape donnée — c'est le
but. Mieux vaut qu'elle meure à l'étape 5 qu'après trois mois de démo.

---

## La stratégie en bref

Spécification complète et justification : [docs/STRATEGY.md](docs/STRATEGY.md).

| | |
|---|---|
| **Thèse** | Time-series momentum : une tendance de plusieurs semaines a historiquement eu une légère autocorrélation positive |
| **Univers** | XAUUSD, XAGUSD, BTCUSD, ETHUSD (paramétrable) |
| **Filtre de régime** | D1 : `close > EMA(200)` autorise les longs, `<` les shorts |
| **Entrée** | H4 : cassure d'un canal de Donchian 60 bougies, dans le sens du régime |
| **Stop** | `3 × ATR(14) **en D1**`, puis suiveur « chandelier » **à cliquet** (ne se desserre jamais) |
| **Sortie** | Canal de Donchian inverse 30 bougies (sortie principale), ou le stop (filet de sécurité). **Pas de take-profit** |
| **Détention** | ~12 jours en moyenne sur données simulées |
| **Sizing** | Risque fixe de 1 % de l'equity par trade, converti en lots via l'ATR |
| **Garde-fous** | Plafond 1,5 % par groupe corrélé, 4 % de risque total, coupe-circuits journalier 5 % et drawdown 25 % |

### Pourquoi pas de take-profit

Ce n'est pas un oubli. Le suivi de tendance est rentable **grâce à** la queue
droite de sa distribution : quelques trades qui courent très loin paient toutes
les petites pertes. Couper à 2×R supprime exactement la partie qui finance la
stratégie.

### Attentes réalistes

Profil attendu : **35 à 45 % de trades gagnants**, gain moyen 2 à 3 fois la
perte moyenne, drawdowns de 20 à 40 %, et des périodes plates pouvant dépasser
un an.

Si un backtest te sort 70 % de trades gagnants, cherche le bug ou le
look-ahead avant de te réjouir.

---

## Deux réserves que je maintiens sur la configuration demandée

### 1. Le panier n'a pas 4 paris, il en a ~2

Or et argent sont historiquement corrélés autour de 0,7–0,8 ; BTC et ETH
souvent au-delà de 0,8 (chiffres approximatifs, à mesurer sur tes données avec
`--correlations`). Le suivi de tendance tire l'essentiel de son ratio de Sharpe
du **nombre de paris indépendants** — un CTA institutionnel en trade 50 à 100.
À 2, la variabilité des résultats est bien plus élevée.

Ajouter les paires forex majeures ferait passer le panier à ~5 paris quasi
indépendants, avec des coûts de transaction plus faibles que la crypto. C'est
un simple paramètre (`InpSymbols`), aucun code à toucher. C'est l'amélioration
qui rapporterait le plus, loin devant n'importe quel réglage.

### 2. Les frais de financement peuvent annuler l'edge sur crypto

Une position de suivi de tendance tient plusieurs semaines. Sur CFD crypto
retail, le swap overnight est souvent assez lourd pour effacer le gain attendu.
Je ne peux pas le chiffrer sans tes taux : c'est exactement ce que mesure
`--cost-sensitivity`, et c'est la **première chose à faire** après compilation.

Si la crypto ne survit pas aux coûts, la conclusion honnête sera de la retirer
du panier — pas d'ajuster les paramètres jusqu'à ce que le backtest redevienne
présentable.

---

## Limites connues

| Limite | Conséquence |
|---|---|
| Le MQL5 n'a pas été compilé | Des erreurs d'API sont possibles ; à corriger au premier passage dans MetaEditor |
| Méthode de lissage de l'ATR incertaine | Je crois que MT5 utilise une SMA du True Range, non vérifié. Voir VALIDATION.md étape 2 |
| Backtest en mode de modélisation dégradé | Biais flatteur mesuré à +0,076 R/trade. Utilise « ticks réels » |
| `DEFAULT_SPECS` sont des conventions, pas tes specs | Tailles de contrat et lots minimums à corriger depuis MT5 |
| Le filtre de régime est dérivé des bougies H4 par resampling | La frontière journalière peut différer de celle du broker de quelques heures |
| Les stops ne protègent pas des gaps | Un stop peut être traversé d'un bloc. Le risque réalisé dépasse alors le risque calculé, et aucun paramètre ne corrige ça |
| Le coupe-circuit journalier se mesure à l'equity | Il peut se déclencher sur un creux intraday suivi d'un retournement |
| Aucune donnée de marché réelle n'a pu être testée | Accès réseau restreint dans cette session. Les CSV de ton broker sont de toute façon la meilleure source |

---

## Avertissement

Le trading à effet de levier peut faire perdre plus que le capital déposé. Ce
code est fourni pour être testé en démo. Rien ici ne constitue un conseil en
investissement, et le fait qu'une stratégie ait fonctionné sur des données
passées ne dit rien de ses résultats futurs.
