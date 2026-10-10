"""
tbcore - moteur de backtest repliquant la logique de l'EA TrendBasket.mq5.

Objectif : pouvoir tester la strategie et sa sensibilite aux couts avant de la
mettre en demo, avec EXACTEMENT les memes regles que l'EA.

Discipline anti-look-ahead, identique a l'EA :
  - La decision pour la bougie i est prise a sa CLOTURE.
  - Le canal de Donchian couvre les bougies [i-N .. i-1] (bougie i exclue).
  - Le filtre de regime utilise la derniere bougie journaliere COMPLETE,
    c'est-a-dire celle de la veille (equivalent de iClose(PERIOD_D1, 1)).
  - L'execution se fait a l'OUVERTURE de la bougie i+1.
  - Les stops touches en cours de bougie sont evalues AVANT la decision de
    cloture de cette meme bougie (ordre chronologique correct).
"""

from __future__ import annotations

import dataclasses
import math
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Parametres
# ---------------------------------------------------------------------------


@dataclasses.dataclass
class Params:
    """Parametres de signal et de risque (memes noms que les inputs de l'EA)."""

    donchian_entry: int = 60
    donchian_exit: int = 30
    atr_period: int = 14
    atr_stop_mult: float = 3.0
    regime_ma_period: int = 200
    atr_spike_mult: float = 2.5
    atr_spike_lookback: int = 100
    max_spread_atr_frac: float = 0.08

    # Timeframe de l'ATR qui determine la distance de stop ET la taille de
    # position. "D1" par defaut, et ce n'est pas un detail :
    #
    # mesure sur donnees synthetiques, ATR(14) : D1 / H4 = 2,83x. Un stop de
    # 3 x ATR(H4) ne vaut donc que ~1,06 x ATR(D1), la ou un suivi de tendance
    # se place classiquement a 2-4 x ATR(D1). Avec l'ATR d'entree, la duree de
    # detention mesuree tombait a 2,8 jours et la sortie sur canal inverse ne se
    # declenchait JAMAIS (105 sorties sur 106 par le stop) : ce n'etait plus du
    # suivi de tendance, mais un systeme de cassure court terme, c'est-a-dire
    # le regime ou les couts dominent.
    #
    # "entry" garde l'ancien comportement, pour comparaison.
    stop_atr_source: str = "D1"  # "D1" | "entry"

    risk_pct_per_trade: float = 1.0
    group_risk_cap_pct: float = 1.5
    portfolio_heat_cap_pct: float = 4.0
    daily_loss_stop_pct: float = 5.0
    max_drawdown_stop_pct: float = 25.0

    allow_long: bool = True
    allow_short: bool = True

    # SMA du True Range, ou lissage de Wilder.
    #
    # INCERTITUDE ASSUMEE : je ne suis pas certain de laquelle des deux
    # l'indicateur ATR integre de MetaTrader 5 utilise. Je crois qu'il s'agit
    # d'une moyenne mobile simple du True Range, c'est pourquoi c'est le defaut
    # ici, mais je n'ai pas pu le verifier depuis cette session.
    # A VERIFIER : comparer atr_series() aux valeurs de l'indicateur ATR dans
    # MT5 sur les memes bougies (voir docs/VALIDATION.md, etape 2).
    atr_method: str = "sma"  # "sma" | "wilder"


@dataclasses.dataclass
class SymbolSpec:
    """Caracteristiques d'un instrument chez le broker.

    HYPOTHESE : les valeurs par defaut utilisees par backtest.py sont des
    conventions courantes, PAS les specifications de ton broker. Releve-les
    dans MT5 (clic droit sur le symbole > Specification) et corrige-les.
    """

    name: str
    group: str
    contract_size: float          # unites de l'actif par lot => valeur d'1.0 de prix par lot
    volume_min: float = 0.01
    volume_step: float = 0.01
    volume_max: float = 100.0
    spread_price: float = 0.0     # spread fixe en unites de prix (si absent du CSV)
    financing_annual_pct: float = 0.0   # cout de portage annuel, en % du notionnel


# ---------------------------------------------------------------------------
# Indicateurs
# ---------------------------------------------------------------------------


def true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    prev_close = close.shift(1)
    a = high - low
    b = (high - prev_close).abs()
    c = (low - prev_close).abs()
    return pd.concat([a, b, c], axis=1).max(axis=1)


def atr_series(df: pd.DataFrame, period: int, method: str = "sma") -> pd.Series:
    tr = true_range(df["high"], df["low"], df["close"])
    if method == "wilder":
        # Lissage de Wilder : alpha = 1/period
        return tr.ewm(alpha=1.0 / period, adjust=False).mean()
    if method == "sma":
        return tr.rolling(period, min_periods=period).mean()
    raise ValueError(f"atr_method inconnu : {method!r}")


def daily_atr_lagged(df: pd.DataFrame, period: int, method: str = "sma") -> pd.Series:
    """ATR calcule sur les bougies journalieres, decale d'un jour.

    Meme discipline que regime_direction() : une bougie du jour J ne voit que
    la journee J-1, deja close. Equivalent de CopyBuffer(iATR(sym, D1, n), 0, 1, 1)
    dans l'EA.
    """
    daily = df.resample("1D").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last"}
    ).dropna(how="any")
    if len(daily) < period + 2:
        return pd.Series(np.nan, index=df.index, dtype="float64")
    atr_d = atr_series(daily, period, method).shift(1)
    mapped = atr_d.reindex(df.index.normalize())
    return pd.Series(mapped.to_numpy(), index=df.index, dtype="float64")


def regime_direction(df: pd.DataFrame, ma_period: int) -> pd.Series:
    """Direction du regime disponible a chaque bougie, sans look-ahead.

    Replique iClose(PERIOD_D1, 1) > iMA(PERIOD_D1, 200)[1] : on resample les
    bougies intraday en journalier, puis on DECALE d'une ligne, de sorte qu'une
    bougie du jour J ne voie que la journee J-1, deja close.
    """
    daily = df.resample("1D").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last"}
    ).dropna(how="any")

    if len(daily) < 2:
        return pd.Series(np.zeros(len(df)), index=df.index, dtype="float64")

    ema = daily["close"].ewm(span=ma_period, adjust=False).mean()
    # Pas de direction avant que l'EMA ait vu assez de donnees.
    ema.iloc[: ma_period - 1] = np.nan

    direction = pd.Series(0.0, index=daily.index)
    direction[daily["close"] > ema] = 1.0
    direction[daily["close"] < ema] = -1.0
    direction[ema.isna()] = np.nan

    available = direction.shift(1)  # la veille, donc close
    mapped = available.reindex(df.index.normalize())
    return pd.Series(mapped.to_numpy(), index=df.index, dtype="float64")


def build_features(df: pd.DataFrame, p: Params) -> pd.DataFrame:
    """Calcule, pour chaque bougie i, tout ce que l'EA lit a la cloture de i."""
    out = pd.DataFrame(index=df.index)
    out["open"] = df["open"]
    out["high"] = df["high"]
    out["low"] = df["low"]
    out["close"] = df["close"]
    out["spread"] = df["spread"] if "spread" in df.columns else np.nan

    out["atr"] = atr_series(df, p.atr_period, p.atr_method)
    out["atr_median"] = out["atr"].rolling(
        p.atr_spike_lookback, min_periods=p.atr_spike_lookback
    ).median()

    # Canal d'entree : bougies [i-N .. i-1], donc rolling puis shift(1).
    out["ch_hi"] = df["high"].rolling(p.donchian_entry, min_periods=p.donchian_entry).max().shift(1)
    out["ch_lo"] = df["low"].rolling(p.donchian_entry, min_periods=p.donchian_entry).min().shift(1)
    out["ex_hi"] = df["high"].rolling(p.donchian_exit, min_periods=p.donchian_exit).max().shift(1)
    out["ex_lo"] = df["low"].rolling(p.donchian_exit, min_periods=p.donchian_exit).min().shift(1)

    out["regime"] = regime_direction(df, p.regime_ma_period)

    # ATR du stop : distinct de l'ATR d'entree (voir Params.stop_atr_source).
    if p.stop_atr_source == "D1":
        out["atr_stop"] = daily_atr_lagged(df, p.atr_period, p.atr_method)
    elif p.stop_atr_source == "entry":
        out["atr_stop"] = out["atr"]
    else:
        raise ValueError(f"stop_atr_source inconnu : {p.stop_atr_source!r}")
    return out


# ---------------------------------------------------------------------------
# Sizing : copie fidele de TryOpen() dans l'EA
# ---------------------------------------------------------------------------


def volume_digits(step: float) -> int:
    if step <= 0:
        return 2
    s, d = step, 0
    while s < 1.0 - 1e-12 and d < 8:
        s *= 10.0
        d += 1
    return d


def size_position(
    equity: float, risk_pct: float, stop_dist: float, spec: SymbolSpec
) -> Tuple[float, float, Optional[str]]:
    """Retourne (lots, risque_en_devise, motif_de_refus)."""
    if stop_dist <= 0:
        return 0.0, 0.0, "stop_dist<=0"

    risk_money = equity * risk_pct / 100.0
    vpp = spec.contract_size  # valeur d'1.0 de variation de prix, pour 1 lot
    raw_lots = risk_money / (stop_dist * vpp)

    step = spec.volume_step if spec.volume_step > 0 else 0.01
    lots = math.floor(raw_lots / step + 1e-9) * step
    lots = round(lots, volume_digits(step))

    # Comme dans l'EA : on REFUSE au lieu d'arrondir au lot minimum, ce qui
    # gonflerait silencieusement le risque reel.
    if lots < spec.volume_min - 1e-12:
        return 0.0, 0.0, f"lot {raw_lots:.5f} < minimum {spec.volume_min}"
    if lots > spec.volume_max:
        lots = spec.volume_max

    return lots, stop_dist * lots * vpp, None


def position_risk_money(
    direction: int, entry: float, sl: float, lots: float, price_now: float, spec: SymbolSpec
) -> float:
    """Risque courant d'une position, meme definition que PositionRiskMoney() de l'EA.

    Seule la part du trajet vers le stop qui passe sous le prix d'entree
    (au-dessus pour un short) compte. Un stop deja au-dela de l'entree compte 0.
    """
    if sl <= 0:
        return lots * entry * spec.contract_size
    if direction > 0:
        risk_price = max(0.0, min(price_now, entry) - sl)
    else:
        risk_price = max(0.0, sl - max(price_now, entry))
    return risk_price * lots * spec.contract_size


# ---------------------------------------------------------------------------
# Etat d'une position ouverte
# ---------------------------------------------------------------------------


@dataclasses.dataclass
class Position:
    symbol: str
    direction: int
    entry_price: float
    lots: float
    sl: float
    entry_time: pd.Timestamp
    extreme: float
    initial_risk: float
    equity_at_entry: float
    financing_paid: float = 0.0


@dataclasses.dataclass
class Trade:
    symbol: str
    direction: int
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    entry_price: float
    exit_price: float
    lots: float
    gross_pnl: float
    financing: float
    net_pnl: float
    initial_risk: float
    equity_at_entry: float
    reason: str

    @property
    def r_multiple(self) -> float:
        return self.net_pnl / self.initial_risk if self.initial_risk > 0 else 0.0

    @property
    def holding_days(self) -> float:
        return (self.exit_time - self.entry_time).total_seconds() / 86400.0


# ---------------------------------------------------------------------------
# Moteur de portefeuille
# ---------------------------------------------------------------------------


class Backtest:
    """Backtest multi-instruments avec equity partagee et plafonds de risque."""

    def __init__(
        self,
        data: Dict[str, pd.DataFrame],
        specs: Dict[str, SymbolSpec],
        params: Params,
        initial_equity: float = 100_000.0,
    ):
        self.params = params
        self.specs = specs
        self.initial_equity = float(initial_equity)

        self.features: Dict[str, pd.DataFrame] = {
            s: build_features(df, params) for s, df in data.items()
        }
        self.raw = data

        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.equity_points: List[Tuple[pd.Timestamp, float]] = []
        self.rejections: Dict[str, int] = {}

        self.closed_equity = self.initial_equity
        self.peak_equity = self.initial_equity
        self.day_start_equity = self.initial_equity
        self.current_day: Optional[pd.Timestamp] = None
        self.halted = False
        self.blocked_bars = 0

    # -- utilitaires ------------------------------------------------------

    def _reject(self, key: str) -> None:
        self.rejections[key] = self.rejections.get(key, 0) + 1

    def _open_pnl(self, prices: Dict[str, float]) -> float:
        total = 0.0
        for sym, pos in self.positions.items():
            px = prices.get(sym, pos.entry_price)
            spec = self.specs[sym]
            total += (px - pos.entry_price) * pos.direction * pos.lots * spec.contract_size
            total -= pos.financing_paid
        return total

    def _equity(self, prices: Dict[str, float]) -> float:
        return self.closed_equity + self._open_pnl(prices)

    def _spread(self, sym: str, row: pd.Series) -> float:
        spec = self.specs[sym]
        sp = row.get("spread", np.nan)
        if sp is not None and not pd.isna(sp):
            return float(sp)
        return spec.spread_price

    # -- boucle principale ------------------------------------------------

    def run(self) -> "Backtest":
        # Chronologie unifiee : (horodatage de cloture, symbole, index de bougie).
        # L'horodatage de cloture d'une bougie est l'ouverture de la suivante,
        # ce qui garantit que les decisions s'ordonnent correctement entre
        # instruments dont les horaires de cotation diffèrent.
        events: List[Tuple[pd.Timestamp, str, int]] = []
        for sym, feat in self.features.items():
            idx = feat.index
            for i in range(len(idx) - 1):
                events.append((idx[i + 1], sym, i))
        events.sort(key=lambda e: (e[0], e[1]))

        last_price: Dict[str, float] = {}

        for close_ts, sym, i in events:
            feat = self.features[sym]
            row = feat.iloc[i]
            nxt = feat.iloc[i + 1]

            last_price[sym] = float(row["close"])

            # --- suivi de l'equity et des coupe-circuits
            self._roll_day(close_ts, last_price)
            eq = self._equity(last_price)
            self.peak_equity = max(self.peak_equity, eq)
            self.equity_points.append((close_ts, eq))

            pos = self.positions.get(sym)

            if pos is not None:
                # 0. Cout de portage de cette bougie (impute avant toute sortie,
                #    pour que la bougie de cloture soit aussi facturee).
                self._on_bar_holding(sym, pos, row)
                # 1. Le stop a-t-il ete touche PENDANT la bougie i ?
                if self._check_stop(sym, pos, row, close_ts):
                    continue
                # 2. Sortie sur canal inverse, a l'ouverture de la bougie i+1
                if self._check_channel_exit(sym, pos, row, nxt, close_ts):
                    continue
                # 3. Stop suiveur
                self._update_trail(sym, pos, row)
                continue

            # --- entree
            blocked = self._entries_blocked(eq)
            if blocked:
                self.blocked_bars += 1
                self._reject(blocked)
                continue

            self._try_open(sym, row, nxt, eq, close_ts, last_price)

        self._close_all(last_price)
        return self

    # -- coupe-circuits ----------------------------------------------------

    def _roll_day(self, ts: pd.Timestamp, prices: Dict[str, float]) -> None:
        day = ts.normalize()
        if self.current_day is None or day != self.current_day:
            self.current_day = day
            self.day_start_equity = self._equity(prices)

    def _entries_blocked(self, eq: float) -> Optional[str]:
        p = self.params
        if self.peak_equity > 0:
            dd = 100.0 * (self.peak_equity - eq) / self.peak_equity
            if dd >= p.max_drawdown_stop_pct:
                self.halted = True
                return "coupe-circuit_drawdown"
        if self.day_start_equity > 0:
            dl = 100.0 * (self.day_start_equity - eq) / self.day_start_equity
            if dl >= p.daily_loss_stop_pct:
                return "coupe-circuit_journalier"
        return None

    # -- sorties -----------------------------------------------------------

    def _check_stop(self, sym: str, pos: Position, row: pd.Series, ts: pd.Timestamp) -> bool:
        """Stop touche en cours de bougie. Un gap est rempli au prix d'ouverture."""
        if pos.direction > 0:
            if float(row["low"]) <= pos.sl:
                fill = min(float(row["open"]), pos.sl)  # gap => pire prix
                self._close(sym, pos, fill, ts, "stop")
                return True
        else:
            if float(row["high"]) >= pos.sl:
                fill = max(float(row["open"]), pos.sl)
                self._close(sym, pos, fill, ts, "stop")
                return True
        return False

    def _check_channel_exit(
        self, sym: str, pos: Position, row: pd.Series, nxt: pd.Series, ts: pd.Timestamp
    ) -> bool:
        ex_hi, ex_lo = row["ex_hi"], row["ex_lo"]
        if pd.isna(ex_hi) or pd.isna(ex_lo):
            return False
        c = float(row["close"])
        hit = (pos.direction > 0 and c < float(ex_lo)) or (pos.direction < 0 and c > float(ex_hi))
        if not hit:
            return False
        spread = self._spread(sym, row)
        # Un long se solde au bid (= open), un short se rachete a l'ask (= open + spread).
        fill = float(nxt["open"]) + (0.0 if pos.direction > 0 else spread)
        self._close(sym, pos, fill, ts, "canal_inverse")
        return True

    def _update_trail(self, sym: str, pos: Position, row: pd.Series) -> None:
        atr = row["atr_stop"]
        if pd.isna(atr) or float(atr) <= 0:
            return
        atr = float(atr)
        if pos.direction > 0:
            pos.extreme = max(pos.extreme, float(row["high"]))
            new_sl = pos.extreme - self.params.atr_stop_mult * atr
            if new_sl > pos.sl:  # cliquet : jamais de desserrage
                pos.sl = new_sl
        else:
            pos.extreme = min(pos.extreme, float(row["low"]))
            new_sl = pos.extreme + self.params.atr_stop_mult * atr
            if new_sl < pos.sl:
                pos.sl = new_sl

    def _close(
        self, sym: str, pos: Position, fill: float, ts: pd.Timestamp, reason: str
    ) -> None:
        spec = self.specs[sym]
        gross = (fill - pos.entry_price) * pos.direction * pos.lots * spec.contract_size
        net = gross - pos.financing_paid
        self.closed_equity += net
        self.trades.append(
            Trade(
                symbol=sym,
                direction=pos.direction,
                entry_time=pos.entry_time,
                exit_time=ts,
                entry_price=pos.entry_price,
                exit_price=fill,
                lots=pos.lots,
                gross_pnl=gross,
                financing=pos.financing_paid,
                net_pnl=net,
                initial_risk=pos.initial_risk,
                equity_at_entry=pos.equity_at_entry,
                reason=reason,
            )
        )
        del self.positions[sym]

    def _close_all(self, prices: Dict[str, float]) -> None:
        for sym in list(self.positions.keys()):
            pos = self.positions[sym]
            px = prices.get(sym, pos.entry_price)
            self._close(sym, pos, px, self.features[sym].index[-1], "fin_de_periode")

    # -- entree ------------------------------------------------------------

    def _try_open(
        self,
        sym: str,
        row: pd.Series,
        nxt: pd.Series,
        eq: float,
        ts: pd.Timestamp,
        last_price: Dict[str, float],
    ) -> None:
        p = self.params
        spec = self.specs[sym]

        for col in ("atr", "atr_stop", "atr_median", "ch_hi", "ch_lo", "regime"):
            if pd.isna(row[col]):
                return

        # atr      : timeframe de signal, sert aux filtres (choc de vol, spread)
        # atr_stop : timeframe du stop, sert a la distance de stop et au sizing
        atr = float(row["atr"])
        atr_stop = float(row["atr_stop"])
        if atr <= 0 or atr_stop <= 0:
            return

        regime = int(row["regime"])
        close = float(row["close"])

        direction = 0
        if p.allow_long and regime == 1 and close > float(row["ch_hi"]):
            direction = 1
        if p.allow_short and regime == -1 and close < float(row["ch_lo"]):
            direction = -1
        if direction == 0:
            return

        # Filtre de choc de volatilite
        med = float(row["atr_median"])
        if med > 0 and atr > p.atr_spike_mult * med:
            self._reject("choc_volatilite")
            return

        # Filtre de spread
        spread = self._spread(sym, row)
        if spread > p.max_spread_atr_frac * atr:
            self._reject("spread_trop_large")
            return

        # Execution a l'ouverture de la bougie suivante : un achat paie l'ask.
        entry = float(nxt["open"]) + (spread if direction > 0 else 0.0)
        stop_dist = p.atr_stop_mult * atr_stop
        sl = entry - stop_dist if direction > 0 else entry + stop_dist

        lots, planned_risk, reason = size_position(eq, p.risk_pct_per_trade, stop_dist, spec)
        if reason is not None:
            self._reject("lot_sous_minimum")
            return

        # Plafonds de risque, memes definitions que AggregateRisk() dans l'EA
        group_risk = 0.0
        total_risk = 0.0
        for osym, opos in self.positions.items():
            ospec = self.specs[osym]
            # Dernier prix CONNU a cet instant. Ne jamais retomber sur la fin de
            # serie : ce serait du look-ahead.
            px = last_price.get(osym, opos.entry_price)
            r = position_risk_money(
                opos.direction, opos.entry_price, opos.sl, opos.lots, px, ospec
            )
            total_risk += r
            if ospec.group == spec.group:
                group_risk += r

        if group_risk + planned_risk > eq * p.group_risk_cap_pct / 100.0 + 1e-9:
            self._reject("plafond_groupe")
            return
        if total_risk + planned_risk > eq * p.portfolio_heat_cap_pct / 100.0 + 1e-9:
            self._reject("plafond_portefeuille")
            return

        self.positions[sym] = Position(
            symbol=sym,
            direction=direction,
            entry_price=entry,
            lots=lots,
            sl=sl,
            entry_time=ts,
            extreme=entry,
            initial_risk=planned_risk,
            equity_at_entry=eq,
        )

    # -- point d'accroche : cout de portage ---------------------------------

    def _on_bar_holding(self, sym: str, pos: Position, row: pd.Series) -> None:
        """Appele a chaque bougie ou une position est ouverte. Sans cout ici."""
        return


# ---------------------------------------------------------------------------
# Variante avec cout de portage
# ---------------------------------------------------------------------------


class BacktestWithFinancing(Backtest):
    """Identique, mais impute un cout de portage proportionnel au temps de detention.

    Le cout est accru a chaque bougie : notionnel x taux_annuel x (duree / 365j).
    C'est une approximation lineaire du swap quotidien d'un CFD. Les swaps reels
    sont fixes par le broker, varient long/short, et sont souvent tripes le
    mercredi : ce modele donne un ORDRE DE GRANDEUR, pas une facture exacte.
    """

    def _on_bar_holding(self, sym: str, pos: Position, row: pd.Series) -> None:
        spec = self.specs[sym]
        rate = spec.financing_annual_pct / 100.0
        if rate == 0.0:
            return
        notional = float(row["close"]) * pos.lots * spec.contract_size
        pos.financing_paid += notional * rate * (self._bar_hours(sym) / (365.0 * 24.0))

    def _bar_hours(self, sym: str) -> float:
        # Mis en cache : recalculer une mediane a chaque bougie rendait le
        # backtest quadratique.
        if not hasattr(self, "_bar_hours_cache"):
            self._bar_hours_cache: Dict[str, float] = {}
        if sym not in self._bar_hours_cache:
            idx = self.features[sym].index
            if len(idx) < 3:
                self._bar_hours_cache[sym] = 4.0
            else:
                delta = pd.Series(idx).diff().dropna().median()
                self._bar_hours_cache[sym] = float(delta.total_seconds()) / 3600.0
        return self._bar_hours_cache[sym]


# ---------------------------------------------------------------------------
# Metriques
# ---------------------------------------------------------------------------


def daily_equity(bt: Backtest) -> pd.Series:
    if not bt.equity_points:
        return pd.Series(dtype="float64")
    s = pd.Series(
        [v for _, v in bt.equity_points],
        index=pd.DatetimeIndex([t for t, _ in bt.equity_points]),
    )
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s.resample("1D").last().ffill()


def metrics(bt: Backtest) -> Dict[str, float]:
    eq = daily_equity(bt)
    out: Dict[str, float] = {}

    if len(eq) < 3:
        return {"erreur_pas_assez_de_donnees": 1.0}

    years = (eq.index[-1] - eq.index[0]).days / 365.25
    total_ret = eq.iloc[-1] / bt.initial_equity - 1.0

    out["equity_finale"] = float(eq.iloc[-1])
    out["rendement_total_pct"] = 100.0 * total_ret
    out["cagr_pct"] = (
        100.0 * ((eq.iloc[-1] / bt.initial_equity) ** (1.0 / years) - 1.0) if years > 0 else 0.0
    )

    rets = eq.pct_change().dropna()
    vol = float(rets.std()) * math.sqrt(365.0)
    out["vol_annualisee_pct"] = 100.0 * vol
    out["sharpe"] = (float(rets.mean()) * 365.0 / vol) if vol > 1e-12 else 0.0

    dd = eq / eq.cummax() - 1.0
    out["max_drawdown_pct"] = 100.0 * float(dd.min())
    out["calmar"] = out["cagr_pct"] / abs(out["max_drawdown_pct"]) if dd.min() < 0 else 0.0

    # Plus longue periode sans nouveau sommet d'equity
    under = (eq < eq.cummax()).astype(int)
    longest, run = 0, 0
    for v in under.to_numpy():
        run = run + 1 if v else 0
        longest = max(longest, run)
    out["plus_longue_stagnation_jours"] = float(longest)

    tr = bt.trades
    out["nb_trades"] = float(len(tr))
    if tr:
        wins = [t for t in tr if t.net_pnl > 0]
        losses = [t for t in tr if t.net_pnl <= 0]
        gross_win = sum(t.net_pnl for t in wins)
        gross_loss = -sum(t.net_pnl for t in losses)
        out["taux_reussite_pct"] = 100.0 * len(wins) / len(tr)
        out["profit_factor"] = gross_win / gross_loss if gross_loss > 1e-12 else float("inf")
        out["gain_moyen"] = gross_win / len(wins) if wins else 0.0
        out["perte_moyenne"] = -gross_loss / len(losses) if losses else 0.0
        out["esperance_en_R"] = float(np.mean([t.r_multiple for t in tr]))
        out["duree_moyenne_jours"] = float(np.mean([t.holding_days for t in tr]))
        fin_total = float(sum(t.financing for t in tr))
        gross_total = float(sum(t.gross_pnl for t in tr))
        out["financement_total"] = fin_total
        # Rapporter le portage a un PnL brut proche de zero produit des
        # pourcentages absurdes (mesure : 17422%) qui ressemblent a un bug.
        # On n'affiche ce ratio que s'il veut dire quelque chose, c'est-a-dire
        # si le brut est au moins 1% du capital initial.
        if abs(gross_total) > 0.01 * bt.initial_equity:
            out["financement_pct_du_brut"] = 100.0 * fin_total / abs(gross_total)
        else:
            out["financement_pct_du_brut"] = float("nan")
    return out


def trades_frame(bt: Backtest) -> pd.DataFrame:
    if not bt.trades:
        return pd.DataFrame()
    return pd.DataFrame(
        [
            {
                "symbole": t.symbol,
                "sens": "LONG" if t.direction > 0 else "SHORT",
                "entree": t.entry_time,
                "sortie": t.exit_time,
                "prix_entree": t.entry_price,
                "prix_sortie": t.exit_price,
                "lots": t.lots,
                "pnl_brut": t.gross_pnl,
                "financement": t.financing,
                "pnl_net": t.net_pnl,
                "R": t.r_multiple,
                "risque_pct": 100.0 * t.initial_risk / t.equity_at_entry
                if t.equity_at_entry > 0
                else 0.0,
                "jours": t.holding_days,
                "motif": t.reason,
            }
            for t in bt.trades
        ]
    )
