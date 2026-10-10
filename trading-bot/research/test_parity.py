"""
Verifie que l'EA MQL5 et le harness Python ont les MEMES valeurs par defaut.

Pourquoi ce test existe : si les deux divergent, le backtest ne decrit plus le
bot qui va reellement trader, et tout le protocole de validation devient faux
sans qu'aucun test ne proteste. C'est le genre de desynchronisation qui
s'installe silencieusement au fil des modifications.

Lancer :  python3 test_parity.py
"""

from __future__ import annotations

import io
import os
import re
import sys

import tbcore as tb

EA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mql5", "Experts", "TrendBasket.mq5",
)

# (input de l'EA, champ de Params, type)
MAPPING = [
    ("InpDonchianEntry", "donchian_entry", int),
    ("InpDonchianExit", "donchian_exit", int),
    ("InpAtrPeriod", "atr_period", int),
    ("InpAtrStopMult", "atr_stop_mult", float),
    ("InpRegimeMaPeriod", "regime_ma_period", int),
    ("InpAtrSpikeMult", "atr_spike_mult", float),
    ("InpAtrSpikeLookback", "atr_spike_lookback", int),
    ("InpMaxSpreadAtrFrac", "max_spread_atr_frac", float),
    ("InpRiskPctPerTrade", "risk_pct_per_trade", float),
    ("InpGroupRiskCapPct", "group_risk_cap_pct", float),
    ("InpPortfolioHeatCapPct", "portfolio_heat_cap_pct", float),
    ("InpDailyLossStopPct", "daily_loss_stop_pct", float),
    ("InpMaxDrawdownStopPct", "max_drawdown_stop_pct", float),
]

# L'ATR du stop doit etre sur la meme unite de temps des deux cotes.
TIMEFRAME_MAPPING = [("InpStopTF", "PERIOD_D1", "stop_atr_source", "D1")]


def parse_inputs(source: str) -> dict:
    return {
        m.group(1): m.group(2).strip()
        for m in re.finditer(r"^input\s+\S+\s+(Inp\w+)\s*=\s*([^;]+);", source, flags=re.M)
    }


def main() -> int:
    if not os.path.exists(EA_PATH):
        print(f"ECHEC: EA introuvable a {EA_PATH}")
        return 1

    inputs = parse_inputs(io.open(EA_PATH, encoding="utf-8").read())
    params = tb.Params()
    problems = []

    print(f"{'input EA':<26}{'valeur EA':>12}{'harness':>12}   etat")
    print("-" * 64)

    for ea_name, py_name, cast in MAPPING:
        if ea_name not in inputs:
            print(f"{ea_name:<26}{'ABSENT':>12}{'':>12}   *** input introuvable ***")
            problems.append(ea_name)
            continue
        try:
            v_ea = cast(inputs[ea_name])
        except ValueError:
            print(f"{ea_name:<26}{inputs[ea_name]:>12}{'':>12}   *** non parsable ***")
            problems.append(ea_name)
            continue
        v_py = cast(getattr(params, py_name))
        ok = abs(v_ea - v_py) < 1e-9
        if not ok:
            problems.append(ea_name)
        print(f"{ea_name:<26}{v_ea:>12}{v_py:>12}   {'ok' if ok else '*** DIVERGENCE ***'}")

    print()
    for ea_name, ea_expected, py_name, py_expected in TIMEFRAME_MAPPING:
        v_ea = inputs.get(ea_name, "?")
        v_py = getattr(params, py_name)
        ok = v_ea == ea_expected and v_py == py_expected
        if not ok:
            problems.append(ea_name)
        print(f"{ea_name:<26}{v_ea:>12}{v_py:>12}   {'ok' if ok else '*** DIVERGENCE ***'}")

    print()
    if problems:
        print(f"DIVERGENCES ({len(problems)}) : {', '.join(problems)}")
        print("Le backtest ne decrit PAS le bot. Aligne les deux avant de tester.")
        return 1
    print(f"{len(MAPPING) + len(TIMEFRAME_MAPPING)} parametres verifies : tout concorde.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
