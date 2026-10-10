#!/usr/bin/env python3
"""
backtest.py - pilote du harness de recherche TrendBasket.

Exemples
--------
  # Validation du moteur sur donnees synthetiques (ne dit rien du reel)
  python3 backtest.py --synthetic

  # Backtest sur TES donnees exportees de MT5
  python3 backtest.py --data ./data

  # Diversification reelle du panier
  python3 backtest.py --data ./data --correlations

  # A partir de quel cout de portage l'edge disparait-il ?
  python3 backtest.py --data ./data --cost-sensitivity

  # Plateau ou pic ? (la question qui decide si la strategie est surajustee)
  python3 backtest.py --data ./data --param-scan

  # Hors echantillon, par fenetres glissantes
  python3 backtest.py --data ./data --walk-forward 5
"""

from __future__ import annotations

import argparse
import dataclasses
import itertools
import os
import sys
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

import tbcore as tb
import tbdata as td

# ---------------------------------------------------------------------------
# Specifications par defaut
#
# HYPOTHESE : ce sont des conventions COURANTES, pas les specifications de ton
# broker. Releve les tiennes dans MT5 (clic droit sur le symbole > Specification)
# et corrige-les ici. Une taille de contrat fausse rend les contraintes de lot
# minimum et les couts de portage faux.
# ---------------------------------------------------------------------------

DEFAULT_SPECS: Dict[str, dict] = {
    "XAUUSD": dict(group="METALS", contract_size=100.0,  volume_min=0.01, volume_step=0.01),
    "XAGUSD": dict(group="METALS", contract_size=5000.0, volume_min=0.01, volume_step=0.01),
    "BTCUSD": dict(group="CRYPTO", contract_size=1.0,    volume_min=0.01, volume_step=0.01),
    "ETHUSD": dict(group="CRYPTO", contract_size=1.0,    volume_min=0.10, volume_step=0.10),
}


def build_specs(
    symbols: List[str], financing: Dict[str, float], spread: Dict[str, float]
) -> Dict[str, tb.SymbolSpec]:
    out: Dict[str, tb.SymbolSpec] = {}
    for s in symbols:
        base = DEFAULT_SPECS.get(s.upper())
        if base is None:
            print(f"  ATTENTION: {s} inconnu, specification generique utilisee "
                  f"(contract_size=1). Corrige DEFAULT_SPECS.", file=sys.stderr)
            base = dict(group=f"SOLO_{s}", contract_size=1.0, volume_min=0.01, volume_step=0.01)
        out[s] = tb.SymbolSpec(
            name=s,
            group=base["group"],
            contract_size=base["contract_size"],
            volume_min=base["volume_min"],
            volume_step=base["volume_step"],
            volume_max=1000.0,
            spread_price=spread.get(s, 0.0),
            financing_annual_pct=financing.get(s, 0.0),
        )
    return out


# ---------------------------------------------------------------------------
# Affichage
# ---------------------------------------------------------------------------

LABELS = {
    "equity_finale": "Equity finale",
    "rendement_total_pct": "Rendement total %",
    "cagr_pct": "CAGR %",
    "vol_annualisee_pct": "Volatilite annualisee %",
    "sharpe": "Sharpe",
    "max_drawdown_pct": "Drawdown max %",
    "calmar": "Calmar (CAGR/DD)",
    "plus_longue_stagnation_jours": "Plus longue stagnation (jours)",
    "nb_trades": "Nombre de trades",
    "taux_reussite_pct": "Taux de reussite %",
    "profit_factor": "Profit factor",
    "gain_moyen": "Gain moyen",
    "perte_moyenne": "Perte moyenne",
    "esperance_en_R": "Esperance par trade (en R)",
    "duree_moyenne_jours": "Duree moyenne (jours)",
    "financement_total": "Cout de portage total",
    "financement_pct_du_brut": "Portage en % du PnL brut",
}


def print_metrics(m: Dict[str, float], title: str) -> None:
    print(f"\n{title}")
    print("-" * len(title))
    for k, label in LABELS.items():
        if k in m:
            v = m[k]
            if v != v:  # NaN : mesure non significative
                print(f"  {label:<32} {'non significatif':>14}")
            elif abs(v) >= 1000:
                print(f"  {label:<32} {v:>14,.0f}")
            else:
                print(f"  {label:<32} {v:>14.3f}")


def print_rejections(bt: tb.Backtest) -> None:
    if not bt.rejections:
        return
    print("\nEntrees refusees (par motif)")
    print("-" * 28)
    for k, v in sorted(bt.rejections.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<28} {v:>8}")


# ---------------------------------------------------------------------------
# Chargement
# ---------------------------------------------------------------------------


def load_data(args) -> Dict[str, pd.DataFrame]:
    if args.synthetic:
        syms = args.symbols or ["XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD"]
        print(f"Donnees SYNTHETIQUES ({args.synthetic_bars} bougies H4, graine {args.seed}).")
        print("ATTENTION : elles valident le MOTEUR, pas la strategie. Aucun")
        print("            resultat obtenu ici ne dit quoi que ce soit du marche reel.")
        out = {}
        for i, s in enumerate(syms):
            out[s] = td.synth_bars(
                args.synthetic_bars,
                start_price=2000.0 if "XAU" in s else 100.0,
                trend="regime",
                seed=args.seed + i,
                annual_vol=0.25 if "XAU" in s else 0.60,
                spread_frac=0.0002,
            )
        return out

    if not args.data:
        print("ERREUR: fournis --data <repertoire> ou --synthetic.", file=sys.stderr)
        sys.exit(2)
    data = td.load_directory(args.data, args.symbols)
    print(f"Donnees chargees depuis {args.data} :")
    for s, df in data.items():
        has_spread = "spread" in df.columns and df["spread"].notna().any()
        print(f"  {s:<10} {len(df):>7} bougies  {df.index[0].date()} -> {df.index[-1].date()}"
              f"   spread {'du CSV' if has_spread else 'ABSENT (mets --spread)'}")
    return data


def params_from_args(args) -> tb.Params:
    return tb.Params(
        donchian_entry=args.donchian_entry,
        donchian_exit=args.donchian_exit,
        atr_period=args.atr_period,
        atr_stop_mult=args.atr_stop,
        regime_ma_period=args.regime_ma,
        risk_pct_per_trade=args.risk,
        group_risk_cap_pct=args.group_cap,
        portfolio_heat_cap_pct=args.heat_cap,
        daily_loss_stop_pct=args.daily_stop,
        max_drawdown_stop_pct=args.dd_stop,
        atr_method=args.atr_method,
        stop_atr_source=args.stop_atr_source,
    )


def kv_pairs(items: Optional[List[str]]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for it in items or []:
        if "=" not in it:
            print(f"ERREUR: '{it}' doit s'ecrire SYMBOLE=valeur.", file=sys.stderr)
            sys.exit(2)
        k, v = it.split("=", 1)
        out[k.strip().upper()] = float(v)
    return out


def make_backtest(data, specs, params, equity, with_financing: bool) -> tb.Backtest:
    cls = tb.BacktestWithFinancing if with_financing else tb.Backtest
    return cls(data, specs, params, equity)


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------


def mode_single(data, specs, params, args) -> None:
    any_fin = any(s.financing_annual_pct != 0 for s in specs.values())
    bt = make_backtest(data, specs, params, args.equity, any_fin).run()
    print_metrics(tb.metrics(bt), "Resultat sur toute la periode")
    print_rejections(bt)

    tf = tb.trades_frame(bt)
    if not tf.empty:
        print("\nPar instrument")
        print("-" * 14)
        g = tf.groupby("symbole").agg(
            trades=("pnl_net", "size"),
            pnl_net=("pnl_net", "sum"),
            R_moyen=("R", "mean"),
            reussite_pct=("pnl_net", lambda x: 100.0 * (x > 0).mean()),
            jours_moyens=("jours", "mean"),
        )
        print(g.round(2).to_string())

        print("\nPar motif de sortie")
        print("-" * 20)
        print(tf.groupby("motif").agg(
            n=("pnl_net", "size"), pnl_net=("pnl_net", "sum"), R_moyen=("R", "mean")
        ).round(2).to_string())

        if args.trades_out:
            tf.to_csv(args.trades_out, index=False)
            print(f"\nTrades ecrits dans {args.trades_out}")


def mode_correlations(data) -> None:
    corr = td.correlation_report(data)
    print("\nCorrelation des rendements journaliers")
    print("-" * 38)
    print(corr.round(3).to_string())
    n = len(corr)
    eff = td.effective_bets(corr)
    print(f"\n  Instruments dans le panier       : {n}")
    print(f"  Paris independants equivalents   : {eff:.2f}")
    print(f"  Diversification effective        : {100.0 * eff / n:.0f}% du maximum")
    print()
    if eff < n * 0.6:
        print("  LECTURE : le panier est nettement moins diversifie que son nombre")
        print("  d'instruments le suggere. Le suivi de tendance tire son ratio de")
        print("  Sharpe du nombre de paris independants : avec si peu, attends-toi")
        print("  a une forte variabilite et a de longues periodes de perte.")
        print("  Ajouter des instruments decorreles (forex majeures) ferait plus")
        print("  pour le resultat que n'importe quel reglage de parametre.")
    else:
        print("  LECTURE : diversification raisonnable pour la taille du panier.")


def mode_cost_sensitivity(data, specs, params, args) -> None:
    """A partir de quel cout de portage la strategie cesse-t-elle de gagner ?"""
    rates = [0.0, 1.0, 2.0, 5.0, 10.0, 15.0, 20.0, 30.0, 50.0]
    print("\nSensibilite au cout de portage (swap)")
    print("-" * 37)
    print("Le taux s'applique a TOUS les instruments, en % annuel du notionnel.\n")
    print(f"  {'taux %/an':>10} {'rendement %':>13} {'CAGR %':>9} {'DD max %':>10} "
          f"{'Sharpe':>8} {'portage':>12} {'% du brut':>10}")

    rows = []
    for r in rates:
        s2 = {
            k: dataclasses.replace(v, financing_annual_pct=r) for k, v in specs.items()
        }
        bt = tb.BacktestWithFinancing(data, s2, params, args.equity).run()
        m = tb.metrics(bt)
        rows.append((r, m))
        print(f"  {r:>10.1f} {m.get('rendement_total_pct', 0):>13.2f} "
              f"{m.get('cagr_pct', 0):>9.2f} {m.get('max_drawdown_pct', 0):>10.2f} "
              f"{m.get('sharpe', 0):>8.2f} {m.get('financement_total', 0):>12,.0f} "
              + (f"{m['financement_pct_du_brut']:>10.1f}"
                 if m.get('financement_pct_du_brut', float('nan')) ==
                    m.get('financement_pct_du_brut', float('nan'))
                 else f"{'n.s.':>10}"))

    # Taux de rupture : premier taux ou le CAGR devient negatif
    breakeven = None
    for i in range(1, len(rows)):
        prev, cur = rows[i - 1], rows[i]
        if prev[1].get("cagr_pct", 0) > 0 >= cur[1].get("cagr_pct", 0):
            a, b = prev[0], cur[0]
            ca, cb = prev[1]["cagr_pct"], cur[1]["cagr_pct"]
            breakeven = a + (b - a) * ca / (ca - cb) if ca != cb else b
            break

    print()
    if rows[0][1].get("cagr_pct", 0) <= 0:
        print("  LECTURE : la strategie ne gagne pas MEME SANS cout de portage sur")
        print("  cette periode. Les couts ne sont pas le probleme : le signal l'est.")
    elif breakeven is None:
        print("  LECTURE : aucun taux teste n'annule l'edge. A confirmer avec les")
        print("  swaps reels de ton broker, qui peuvent depasser 50%/an sur CFD crypto.")
    else:
        print(f"  TAUX DE RUPTURE : environ {breakeven:.1f}% par an.")
        print("  Au-dela, cette strategie perd de l'argent sur cette periode.")
        print()
        print("  A FAIRE : releve les swaps reels de ton broker (clic droit sur le")
        print("  symbole dans MT5 > Specification > 'Swap long' / 'Swap short'),")
        print("  convertis-les en % annuel, et compare a ce seuil. Si le swap reel")
        print("  depasse le seuil, la conclusion honnete est de RETIRER l'instrument")
        print("  du panier, pas d'ajuster les parametres jusqu'a ce que ca repasse.")


def mode_param_scan(data, specs, params, args) -> None:
    """Plateau ou pic ? C'est la question qui decide si la strategie est surajustee."""
    entries = [30, 40, 50, 60, 80, 100, 120]
    stops = [2.0, 2.5, 3.0, 3.5, 4.0, 5.0]

    print("\nBalayage de parametres - CAGR % (lignes: canal d'entree, colonnes: multiple ATR du stop)")
    print("-" * 88)
    any_fin = any(s.financing_annual_pct != 0 for s in specs.values())

    grid = np.full((len(entries), len(stops)), np.nan)
    header = "  canal  " + "".join(f"{s:>10.1f}" for s in stops)
    print(header)
    for i, n in enumerate(entries):
        line = f"  {n:>5}  "
        for j, k in enumerate(stops):
            p = dataclasses.replace(
                params, donchian_entry=n, donchian_exit=max(3, n // 2), atr_stop_mult=k
            )
            bt = make_backtest(data, specs, p, args.equity, any_fin).run()
            c = tb.metrics(bt).get("cagr_pct", float("nan"))
            grid[i, j] = c
            line += f"{c:>10.2f}"
        print(line)

    flat = grid[~np.isnan(grid)]
    if flat.size == 0:
        print("\n  Aucun resultat exploitable.")
        return

    best = np.unravel_index(np.nanargmax(grid), grid.shape)
    frac_pos = float((flat > 0).mean())
    print()
    print(f"  Meilleure combinaison : canal={entries[best[0]]}, stop={stops[best[1]]}x "
          f"-> CAGR {grid[best]:.2f}%")
    print(f"  Mediane de la grille  : {np.nanmedian(grid):.2f}%")
    print(f"  Combinaisons positives: {100.0 * frac_pos:.0f}% ({int((flat > 0).sum())}/{flat.size})")
    print()
    print("  COMMENT LIRE CETTE GRILLE - c'est le test le plus important du lot.")
    print()
    print("  Ce qu'on NE cherche PAS : la meilleure case. Prendre le maximum d'une")
    print("  grille, c'est choisir le bruit le plus flatteur.")
    print()
    print("  Ce qu'on cherche : un PLATEAU. Une large zone contigue ou tout")
    print("  fonctionne a peu pres, dont on prend le CENTRE. Si seules quelques")
    print("  cases isolees sont bonnes et que leurs voisines sont mauvaises, la")
    print("  strategie est surajustee et ne survivra pas en demo.")
    if frac_pos < 0.6:
        print()
        print(f"  ICI : seulement {100.0*frac_pos:.0f}% des combinaisons sont positives.")
        print("  C'est le profil d'un pic, pas d'un plateau. Signal de prudence.")
    else:
        print()
        print(f"  ICI : {100.0*frac_pos:.0f}% des combinaisons sont positives, ce qui")
        print("  ressemble a un plateau. Place-toi au centre de la zone, pas au maximum.")


def mode_walk_forward(data, specs, params, args) -> None:
    """Hors echantillon ancre : on optimise sur le passe, on mesure sur la suite.

    C'est la seule mesure qui ressemble a ce que vivra le bot en demo : des
    parametres choisis sans connaitre la periode sur laquelle ils seront juges.
    """
    k = args.walk_forward
    all_times = sorted(set().union(*[set(df.index) for df in data.values()]))
    if len(all_times) < 200 * (k + 1):
        print(f"\nPas assez d'historique pour {k} fenetres. Reduis --walk-forward.")
        return

    # Erreur d'indice a eviter : pour i = k+1, int(n*(k+1)/(k+1)) vaut n, donc
    # hors limites. On construit les k+1 premieres bornes par la formule, puis
    # on ajoute une sentinelle strictement APRES la derniere bougie, afin que
    # les tests "index < borne" incluent bien la derniere bougie.
    n_times = len(all_times)
    bounds = [all_times[int(n_times * i / (k + 1))] for i in range(k + 1)]
    bounds.append(all_times[-1] + pd.Timedelta(seconds=1))
    entries = [30, 50, 60, 80, 100]
    stops = [2.0, 2.5, 3.0, 4.0]
    any_fin = any(s.financing_annual_pct != 0 for s in specs.values())

    print(f"\nWalk-forward ancre, {k} fenetres hors echantillon")
    print("-" * 50)
    print(f"  {'fenetre':>8} {'debut IS':>12} {'fin IS':>12} {'fin OOS':>12} "
          f"{'canal*':>7} {'stop*':>6} {'CAGR IS':>9} {'CAGR OOS':>10}")

    oos_cagrs, picks = [], []
    for f in range(k):
        is_end = bounds[f + 1]
        oos_end = bounds[f + 2]

        is_data = {s: df[df.index < is_end] for s, df in data.items()}
        is_data = {s: d for s, d in is_data.items() if len(d) > 400}
        if not is_data:
            continue

        best, best_p = None, None
        for n, kk in itertools.product(entries, stops):
            p = dataclasses.replace(
                params, donchian_entry=n, donchian_exit=max(3, n // 2), atr_stop_mult=kk
            )
            m = tb.metrics(make_backtest(is_data, specs, p, args.equity, any_fin).run())
            score = m.get("calmar", -99)
            if best is None or score > best:
                best, best_p = score, (n, kk)

        n, kk = best_p
        p = dataclasses.replace(
            params, donchian_entry=n, donchian_exit=max(3, n // 2), atr_stop_mult=kk
        )
        is_m = tb.metrics(make_backtest(is_data, specs, p, args.equity, any_fin).run())

        # Hors echantillon : meme warm-up d'indicateurs, mais seule la periode
        # suivante est comptee. On le simule en demarrant le backtest assez tot
        # puis en ne gardant que les trades ouverts apres is_end.
        oos_data = {
            s: df[(df.index >= bounds[f]) & (df.index < oos_end)] for s, df in data.items()
        }
        oos_data = {s: d for s, d in oos_data.items() if len(d) > 300}
        if not oos_data:
            continue
        bt = make_backtest(oos_data, specs, p, args.equity, any_fin).run()
        oos_trades = [t for t in bt.trades if t.entry_time >= is_end]
        pnl = sum(t.net_pnl for t in oos_trades)
        years = max((oos_end - is_end).days / 365.25, 0.05)
        oos_cagr = 100.0 * (((args.equity + pnl) / args.equity) ** (1.0 / years) - 1.0)

        oos_cagrs.append(oos_cagr)
        picks.append(best_p)
        print(f"  {f+1:>8} {str(bounds[0].date()):>12} {str(is_end.date()):>12} "
              f"{str(oos_end.date()):>12} {n:>7} {kk:>6.1f} "
              f"{is_m.get('cagr_pct', 0):>9.2f} {oos_cagr:>10.2f}")

    if not oos_cagrs:
        print("\n  Aucune fenetre exploitable.")
        return

    arr = np.array(oos_cagrs)
    print()
    print(f"  CAGR hors echantillon  : moyenne {arr.mean():+.2f}%  mediane {np.median(arr):+.2f}%")
    print(f"  Fenetres positives     : {int((arr > 0).sum())}/{len(arr)}")
    print(f"  Parametres retenus     : {picks}")
    print()
    print("  COMMENT LIRE :")
    print("  - Si le CAGR hors echantillon est tres inferieur au CAGR in-sample,")
    print("    l'optimisation capturait du bruit. C'est le cas le plus frequent.")
    print("  - Si les parametres retenus SAUTENT d'une fenetre a l'autre, il n'y a")
    print("    pas de reglage stable : mauvais signe, meme si le resultat est bon.")
    print("  - Si moins de la moitie des fenetres sont positives, ne mets pas cette")
    print("    strategie en demo en esperant mieux. Il n'y aura pas mieux.")


# ---------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Harness de recherche TrendBasket",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    src = ap.add_argument_group("source de donnees")
    src.add_argument("--data", help="Repertoire de CSV exportes de MT5 (un par symbole)")
    src.add_argument("--synthetic", action="store_true", help="Donnees synthetiques (valide le moteur)")
    src.add_argument("--synthetic-bars", type=int, default=12000)
    src.add_argument("--seed", type=int, default=1)
    src.add_argument("--symbols", nargs="*", help="Restreindre a ces symboles")

    pg = ap.add_argument_group("parametres de strategie")
    pg.add_argument("--donchian-entry", type=int, default=60)
    pg.add_argument("--donchian-exit", type=int, default=30)
    pg.add_argument("--atr-period", type=int, default=14)
    pg.add_argument("--atr-stop", type=float, default=3.0)
    pg.add_argument("--regime-ma", type=int, default=200)
    pg.add_argument("--atr-method", choices=["sma", "wilder"], default="sma",
                    help="Lissage de l'ATR. Voir docs/VALIDATION.md etape 2.")
    pg.add_argument("--stop-atr-source", choices=["D1", "entry"], default="D1",
                    help="Timeframe de l'ATR qui fixe le stop et le sizing. "
                         "D1 par defaut : avec l'ATR H4, le stop est ~2,8x trop "
                         "serre pour du suivi de tendance.")

    rg = ap.add_argument_group("risque")
    rg.add_argument("--equity", type=float, default=100_000.0)
    rg.add_argument("--risk", type=float, default=1.0)
    rg.add_argument("--group-cap", type=float, default=1.5)
    rg.add_argument("--heat-cap", type=float, default=4.0)
    rg.add_argument("--daily-stop", type=float, default=5.0)
    rg.add_argument("--dd-stop", type=float, default=25.0)

    cg = ap.add_argument_group("couts")
    cg.add_argument("--financing", nargs="*", metavar="SYM=PCT",
                    help="Cout de portage annuel en %%, ex: BTCUSD=25 ETHUSD=25")
    cg.add_argument("--spread", nargs="*", metavar="SYM=PRIX",
                    help="Spread fixe en unites de prix si absent du CSV, ex: XAUUSD=0.30")

    mg = ap.add_argument_group("modes d'analyse")
    mg.add_argument("--correlations", action="store_true")
    mg.add_argument("--cost-sensitivity", action="store_true")
    mg.add_argument("--param-scan", action="store_true")
    mg.add_argument("--walk-forward", type=int, default=0, metavar="K")
    mg.add_argument("--trades-out", metavar="FICHIER.csv")

    args = ap.parse_args()

    data = load_data(args)
    specs = build_specs(list(data.keys()), kv_pairs(args.financing), kv_pairs(args.spread))
    params = params_from_args(args)

    # Garde-fou de coherence : le plafond de groupe sous le risque par trade
    # fait refuser TOUTES les entrees, silencieusement.
    if params.group_risk_cap_pct < params.risk_pct_per_trade:
        print(f"\nERREUR DE PARAMETRAGE: --group-cap ({params.group_risk_cap_pct}%) est "
              f"inferieur a --risk ({params.risk_pct_per_trade}%).", file=sys.stderr)
        print("Aucune entree ne serait possible. Augmente --group-cap.", file=sys.stderr)
        return 2

    missing_spread = [
        s for s, df in data.items()
        if ("spread" not in df.columns or not df["spread"].notna().any())
        and specs[s].spread_price == 0.0
    ]
    if missing_spread:
        print(f"\nATTENTION: aucun spread pour {', '.join(missing_spread)}. Le backtest")
        print("           sera OPTIMISTE. Fournis --spread SYM=prix.")

    ran = False
    if args.correlations:
        mode_correlations(data); ran = True
    if args.cost_sensitivity:
        mode_cost_sensitivity(data, specs, params, args); ran = True
    if args.param_scan:
        mode_param_scan(data, specs, params, args); ran = True
    if args.walk_forward:
        mode_walk_forward(data, specs, params, args); ran = True
    if not ran:
        mode_single(data, specs, params, args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
