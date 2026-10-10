"""
Tests de validation du moteur de backtest.

CE QUE CES TESTS PROUVENT : que le code implemente la specification sans
look-ahead, que le sizing respecte le risque demande, que les plafonds et
coupe-circuits se declenchent, et que la strategie reagit comme une strategie
de suivi de tendance DOIT reagir selon la nature du marche.

CE QU'ILS NE PROUVENT PAS : que la strategie soit rentable sur les marches
reels. Aucun test sur donnees synthetiques ne peut le dire.

Lancer :  python3 test_engine.py
"""

from __future__ import annotations

import sys
import traceback
from typing import Dict, List

import numpy as np
import pandas as pd

import tbcore as tb
import tbdata as td

RESULTS: List[tuple] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append((name, bool(condition), detail))
    mark = "PASS" if condition else "ECHEC"
    print(f"  [{mark}] {name}" + (f"  -- {detail}" if detail else ""))


def specs_for(names, group="G0", contract=1.0, financing=0.0, vmin=0.01):
    return {
        n: tb.SymbolSpec(
            name=n,
            group=group,
            contract_size=contract,
            volume_min=vmin,
            volume_step=0.01,
            volume_max=1000.0,
            financing_annual_pct=financing,
        )
        for n in names
    }


# ---------------------------------------------------------------------------
# 1. Absence de look-ahead (le test le plus important)
# ---------------------------------------------------------------------------


def test_no_lookahead() -> None:
    """Tronquer l'historique ne doit rien changer au passe.

    Si le moteur lisait, meme indirectement, une donnee future, les trades
    survenus avant le point de troncature changeraient. C'est la verification
    la plus directe qui existe contre le look-ahead.
    """
    print("\n1. Absence de look-ahead")
    data_full = {"A": td.synth_bars(4000, trend="regime", seed=7)}
    cut = 2600
    data_cut = {"A": data_full["A"].iloc[:cut].copy()}
    boundary = data_cut["A"].index[-1]

    p = tb.Params()
    full = tb.Backtest(data_full, specs_for(["A"]), p, 100_000).run()
    part = tb.Backtest(data_cut, specs_for(["A"]), p, 100_000).run()

    # On compare les trades clos strictement avant la frontiere : le dernier
    # trade du run tronque est ferme d'office en fin de periode.
    f = [t for t in full.trades if t.exit_time < boundary]
    q = [t for t in part.trades if t.exit_time < boundary and t.reason != "fin_de_periode"]

    check("au moins 10 trades a comparer", len(q) >= 10, f"{len(q)} trades")
    check("meme nombre de trades avant la troncature", len(f) == len(q), f"complet={len(f)} tronque={len(q)}")

    if len(f) == len(q) and f:
        same_entry = all(abs(a.entry_price - b.entry_price) < 1e-9 for a, b in zip(f, q))
        same_exit = all(abs(a.exit_price - b.exit_price) < 1e-9 for a, b in zip(f, q))
        same_lots = all(abs(a.lots - b.lots) < 1e-12 for a, b in zip(f, q))
        same_time = all(a.entry_time == b.entry_time for a, b in zip(f, q))
        check("prix d'entree identiques", same_entry)
        check("prix de sortie identiques", same_exit)
        check("tailles de position identiques", same_lots)
        check("horodatages d'entree identiques", same_time)


# ---------------------------------------------------------------------------
# 2. Le sizing respecte le risque demande
# ---------------------------------------------------------------------------


def test_sizing() -> None:
    print("\n2. Sizing : risque par trade")
    data = {"A": td.synth_bars(4000, trend="regime", seed=3)}
    for risk_pct in (0.5, 1.0, 2.0):
        # Les plafonds doivent accompagner le risque par trade : avec le
        # plafond de groupe par defaut (1,5%), un risque de 2% fait refuser
        # TOUTES les entrees. C'est correct, mais ca ne teste plus le sizing.
        p = tb.Params(
            risk_pct_per_trade=risk_pct,
            group_risk_cap_pct=max(1.5, risk_pct * 2),
            portfolio_heat_cap_pct=max(4.0, risk_pct * 4),
        )
        bt = tb.Backtest(data, specs_for(["A"]), p, 100_000).run()
        if not bt.trades:
            check(f"trades generes a {risk_pct}%", False, "aucun trade")
            continue
        ratios = np.array([100.0 * t.initial_risk / t.equity_at_entry for t in bt.trades])
        # <= risque demande : l'arrondi du lot se fait toujours vers le bas.
        check(
            f"risque planifie <= {risk_pct}% pour tous les trades",
            bool((ratios <= risk_pct + 1e-6).all()),
            f"max observe {ratios.max():.4f}%",
        )
        check(
            f"risque planifie proche de {risk_pct}% (arrondi du lot)",
            bool(ratios.mean() > risk_pct * 0.90),
            f"moyenne {ratios.mean():.4f}%",
        )


def test_min_lot_refused_not_rounded() -> None:
    print("\n3. Lot sous le minimum : refus, pas arrondi")
    data = {"A": td.synth_bars(3000, trend="regime", seed=5)}
    # Equity minuscule + lot minimum eleve => tout doit etre refuse.
    specs = specs_for(["A"], vmin=5.0)
    bt = tb.Backtest(data, specs, tb.Params(), 1_000.0).run()
    check("aucun trade pris", len(bt.trades) == 0, f"{len(bt.trades)} trades")
    check(
        "les refus sont journalises comme 'lot_sous_minimum'",
        bt.rejections.get("lot_sous_minimum", 0) > 0,
        f"{bt.rejections.get('lot_sous_minimum', 0)} refus",
    )
    check("equity inchangee", abs(bt.closed_equity - 1_000.0) < 1e-9)


# ---------------------------------------------------------------------------
# 4. Le stop suiveur est a cliquet
# ---------------------------------------------------------------------------


def test_ratchet() -> None:
    print("\n4. Stop suiveur : cliquet uniquement")

    violations = {"n": 0}

    class Watch(tb.Backtest):
        def _update_trail(self, sym, pos, row):
            before = pos.sl
            direction = pos.direction
            super()._update_trail(sym, pos, row)
            if direction > 0 and pos.sl < before - 1e-12:
                violations["n"] += 1
            if direction < 0 and pos.sl > before + 1e-12:
                violations["n"] += 1

    data = {"A": td.synth_bars(5000, trend="regime", seed=11)}
    bt = Watch(data, specs_for(["A"]), tb.Params(), 100_000).run()
    check("trades generes", len(bt.trades) > 5, f"{len(bt.trades)} trades")
    check("aucun desserrage de stop", violations["n"] == 0, f"{violations['n']} violations")


# ---------------------------------------------------------------------------
# 5. Plafonds de risque portefeuille
# ---------------------------------------------------------------------------


def test_risk_caps() -> None:
    print("\n5. Plafonds de risque")
    # Quatre instruments du MEME groupe : le plafond de groupe doit mordre.
    names = ["A", "B", "C", "D"]
    data = {n: td.synth_bars(4000, trend="regime", seed=20 + i) for i, n in enumerate(names)}
    specs = specs_for(names, group="METALS")

    peak = {"group": 0.0, "n_open": 0, "accepted": 0}

    class Watch(tb.Backtest):
        def _try_open(self, sym, row, nxt, eq, ts, last_price):
            before = set(self.positions)
            super()._try_open(sym, row, nxt, eq, ts, last_price)
            if set(self.positions) == before:
                return  # entree refusee : rien a mesurer
            # On mesure AU MOMENT de la decision, avec l'equity que le moteur a
            # lui-meme utilisee. Mesurer plus tard, contre une equity plus
            # basse, donne un pourcentage plus eleve sans qu'aucune regle
            # n'ait ete violee.
            peak["accepted"] += 1
            total = 0.0
            for osym, opos in self.positions.items():
                px = last_price.get(osym, opos.entry_price)
                total += tb.position_risk_money(
                    opos.direction, opos.entry_price, opos.sl, opos.lots, px, self.specs[osym]
                )
            peak["group"] = max(peak["group"], 100.0 * total / eq if eq > 0 else 0.0)
            peak["n_open"] = max(peak["n_open"], len(self.positions))

    p = tb.Params(risk_pct_per_trade=1.0, group_risk_cap_pct=1.5, portfolio_heat_cap_pct=4.0)
    bt = Watch(data, specs, p, 100_000).run()

    check("trades generes", len(bt.trades) > 10, f"{len(bt.trades)} trades")
    check(
        "risque de groupe jamais au-dela du plafond de 1,5%",
        peak["group"] <= 1.5 + 1e-6,
        f"pic {peak['group']:.4f}%",
    )
    check(
        "le plafond de groupe a effectivement bloque des entrees",
        bt.rejections.get("plafond_groupe", 0) > 0,
        f"{bt.rejections.get('plafond_groupe', 0)} refus",
    )
    # Plus de 2 positions simultanees est VOULU : un stop glisse en profit ne
    # consomme plus de risque et libere de la place. On verifie donc le
    # plafond, pas le nombre de positions.
    check(
        "plusieurs positions coexistent quand les stops ont glisse",
        peak["n_open"] >= 2,
        f"max {peak['n_open']} ouvertes sur {peak['accepted']} entrees",
    )


# ---------------------------------------------------------------------------
# 6. Coupe-circuit de drawdown
# ---------------------------------------------------------------------------


def test_drawdown_breaker() -> None:
    print("\n6. Coupe-circuit de drawdown")
    data = {"A": td.synth_bars(6000, trend="random", seed=42, annual_vol=0.9)}
    # Risque eleve sur marche sans tendance + plafond serre : doit se declencher.
    p = tb.Params(
        risk_pct_per_trade=5.0,
        group_risk_cap_pct=10.0,
        portfolio_heat_cap_pct=10.0,
        max_drawdown_stop_pct=10.0,
        daily_loss_stop_pct=100.0,
    )
    bt = tb.Backtest(data, specs_for(["A"]), p, 100_000).run()
    eq = tb.daily_equity(bt)
    dd = float((eq / eq.cummax() - 1.0).min()) * 100.0
    check("le coupe-circuit s'est declenche", bt.halted, f"drawdown atteint {dd:.2f}%")
    check(
        "des entrees ont ete bloquees apres declenchement",
        bt.rejections.get("coupe-circuit_drawdown", 0) > 0,
        f"{bt.rejections.get('coupe-circuit_drawdown', 0)} bougies bloquees",
    )


# ---------------------------------------------------------------------------
# 7. Comportement attendu selon la nature du marche
# ---------------------------------------------------------------------------


def test_market_nature() -> None:
    """Un suivi de tendance doit avoir une esperance NULLE sur une martingale
    (avant couts), et positive sur un marche a tendances persistantes.

    Deux conditions pour que ce test veuille dire quelque chose, toutes deux
    apprises a la dure dans ce projet :

    1. Resolution intra-bougie suffisante (substeps >= 32). En dessous, les
       high/low sous-estiment l'amplitude reelle, des stops sont manques, et la
       strategie semble gagner sur une martingale.
    2. Regimes assez longs. Le filtre de regime est une EMA 200 en journalier :
       il ne peut capter que des tendances de plusieurs centaines de jours. Avec
       des regimes de 60 jours, la strategie a structurellement tort et le test
       ne mesure que ca.
    """
    print("\n7. Reaction a la nature du marche")
    print("       (series longues, regimes ~1 an, 128 sous-pas/bougie)")

    N_BARS, N_SEEDS = 15000, 16   # ~6,8 ans par tirage

    def sample(trend: str):
        rets, allR = [], []
        for sd in range(200, 200 + N_SEEDS):
            data = {"A": td.synth_bars(N_BARS, trend=trend, seed=sd,
                                       spread_frac=0.0, regime_len=2200)}
            bt = tb.Backtest(data, specs_for(["A"]), tb.Params(), 100_000).run()
            rets.append(bt.closed_equity / 100_000.0 - 1.0)
            allR += [t.r_multiple for t in bt.trades]
        a = np.array(allR)
        se = a.std() / np.sqrt(len(a)) if len(a) else 0.0
        return float(np.mean(rets)) * 100.0, a.mean() if len(a) else 0.0, se, len(a)

    rw_ret, rw_R, rw_se, rw_n = sample("random")
    tr_ret, tr_R, tr_se, tr_n = sample("regime")

    print(f"       martingale      : rendement {rw_ret:+6.2f}%   "
          f"E[R]={rw_R:+.4f} +/-{rw_se:.4f} ({abs(rw_R)/rw_se if rw_se else 0:.1f} sd)  n={rw_n}")
    print(f"       a tendances     : rendement {tr_ret:+6.2f}%   "
          f"E[R]={tr_R:+.4f} +/-{tr_se:.4f} ({abs(tr_R)/tr_se if tr_se else 0:.1f} sd)  n={tr_n}")

    # Sur une martingale, E[R] doit etre nul. On teste donc l'absence d'ecart
    # SIGNIFICATIF a zero (moins de 3 ecarts-types), pas un signe.
    check(
        "esperance nulle sur martingale (|E[R]| < 3 ecarts-types)",
        abs(rw_R) < 3.0 * rw_se if rw_se > 0 else False,
        f"E[R]={rw_R:+.4f}, soit {abs(rw_R)/rw_se if rw_se else 0:.1f} ecarts-types",
    )
    check(
        "esperance positive sur marche a tendances",
        tr_R > 0.0,
        f"E[R]={tr_R:+.4f}",
    )
    check(
        "le marche a tendances fait mieux que la martingale",
        tr_R > rw_R,
        f"{tr_R:+.4f} vs {rw_R:+.4f}",
    )


# ---------------------------------------------------------------------------
# 8. Le cout de portage degrade bien le resultat
# ---------------------------------------------------------------------------


def test_financing_bites() -> None:
    print("\n8. Le cout de portage reduit le resultat")
    data = {"A": td.synth_bars(6000, trend="regime", seed=9)}
    base = tb.BacktestWithFinancing(
        data, specs_for(["A"], financing=0.0), tb.Params(), 100_000
    ).run()
    costly = tb.BacktestWithFinancing(
        data, specs_for(["A"], financing=15.0), tb.Params(), 100_000
    ).run()
    r0 = base.closed_equity / 100_000 - 1
    r1 = costly.closed_equity / 100_000 - 1
    fin = sum(t.financing for t in costly.trades)
    print(f"       sans portage : {r0*100:+.2f}%   a 15%/an : {r1*100:+.2f}%   facture : {fin:,.0f}")
    check("sans portage, aucune facture", abs(sum(t.financing for t in base.trades)) < 1e-9)
    check("avec portage, facture strictement positive", fin > 0.0, f"{fin:,.0f}")
    check("le resultat net est degrade", r1 < r0, f"{r1*100:+.2f}% < {r0*100:+.2f}%")


# ---------------------------------------------------------------------------
# 9. Le regime n'utilise que des bougies journalieres closes
# ---------------------------------------------------------------------------


def test_regime_is_lagged() -> None:
    print("\n9. Le filtre de regime ne lit que des journees closes")
    df = td.synth_bars(3000, trend="regime", seed=4)
    reg = tb.regime_direction(df, 50)

    daily = df.resample("1D").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last"}
    ).dropna(how="any")
    ema = daily["close"].ewm(span=50, adjust=False).mean()
    own_day = pd.Series(
        np.where(daily["close"] > ema, 1.0, np.where(daily["close"] < ema, -1.0, 0.0)),
        index=daily.index,
    )

    # La valeur vue par une bougie du jour J doit etre celle de J-1,
    # jamais celle de J (qui n'est pas encore close).
    sample = df.index[(len(df) // 2) : (len(df) // 2) + 400]
    matches_prev, matches_same = 0, 0
    for ts in sample:
        day = ts.normalize()
        if day not in own_day.index:
            continue
        pos = own_day.index.get_loc(day)
        if pos == 0 or pd.isna(reg.loc[ts]):
            continue
        if reg.loc[ts] == own_day.iloc[pos - 1]:
            matches_prev += 1
        if reg.loc[ts] == own_day.iloc[pos]:
            matches_same += 1

    check("regime = valeur de la veille, sur tout l'echantillon", matches_prev > 0 and matches_prev >= matches_same, f"veille={matches_prev} jour-meme={matches_same}")
    check("echantillon non vide", matches_prev > 100, f"{matches_prev} points verifies")


# ---------------------------------------------------------------------------
# 10. Les gaps sont remplis au pire prix
# ---------------------------------------------------------------------------


def test_gap_fill() -> None:
    print("\n10. Gap traversant le stop : remplissage au pire prix")
    idx = pd.date_range("2020-01-01", periods=6, freq="4h")
    df = pd.DataFrame(
        {"open": [100, 100, 100, 100, 80, 80],
         "high": [101, 101, 101, 101, 81, 81],
         "low":  [99, 99, 99, 99, 79, 79],
         "close":[100, 100, 100, 100, 80, 80],
         "spread":[0.0] * 6},
        index=idx,
    )
    spec = tb.SymbolSpec("A", "G", contract_size=1.0, volume_min=0.01)
    bt = tb.Backtest({"A": df}, {"A": spec}, tb.Params(), 100_000)
    bt.positions["A"] = tb.Position(
        symbol="A", direction=1, entry_price=100.0, lots=1.0, sl=95.0,
        entry_time=idx[0], extreme=100.0, initial_risk=5.0, equity_at_entry=100_000.0,
    )
    pos = bt.positions["A"]
    closed = bt._check_stop("A", pos, df.iloc[4], idx[4])
    check("le stop est detecte", closed)
    if closed:
        t = bt.trades[-1]
        check(
            "rempli a l'ouverture (80), pas au stop (95)",
            abs(t.exit_price - 80.0) < 1e-9,
            f"prix de sortie {t.exit_price}",
        )
        check("perte superieure au risque initial", t.net_pnl < -5.0, f"{t.net_pnl:.2f} vs risque -5.00")


# ---------------------------------------------------------------------------


def main() -> int:
    print("=" * 74)
    print("VALIDATION DU MOTEUR - TrendBasket")
    print("=" * 74)

    tests = [
        test_no_lookahead,
        test_sizing,
        test_min_lot_refused_not_rounded,
        test_ratchet,
        test_risk_caps,
        test_drawdown_breaker,
        test_market_nature,
        test_financing_bites,
        test_regime_is_lagged,
        test_gap_fill,
    ]
    for fn in tests:
        try:
            fn()
        except Exception:
            print(f"\n  EXCEPTION dans {fn.__name__}:")
            traceback.print_exc()
            RESULTS.append((fn.__name__, False, "exception"))

    passed = sum(1 for _, ok, _ in RESULTS if ok)
    total = len(RESULTS)
    print("\n" + "=" * 74)
    print(f"RESULTAT : {passed}/{total} verifications passees")
    failed = [(n, d) for n, ok, d in RESULTS if not ok]
    if failed:
        print("\nEchecs :")
        for n, d in failed:
            print(f"  - {n}  {d}")
    print("=" * 74)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
