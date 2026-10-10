"""
tbdata - chargement des donnees et generation de series synthetiques.

Deux sources :
  1. CSV exportes depuis MetaTrader 5 (source a privilegier : ce sont les prix
     et les spreads reels de TON broker).
  2. Series synthetiques, pour VALIDER LE MOTEUR. Elles ne disent rien de la
     rentabilite reelle de la strategie : elles servent a verifier que le code
     se comporte comme prevu sur des marches dont on connait la nature.
"""

from __future__ import annotations

import io
import os
import re
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Chargement CSV
# ---------------------------------------------------------------------------

_COLMAP = {
    "date": "date", "<date>": "date",
    "time": "time", "<time>": "time",
    "datetime": "datetime", "timestamp": "datetime",
    "open": "open", "<open>": "open",
    "high": "high", "<high>": "high",
    "low": "low", "<low>": "low",
    "close": "close", "<close>": "close",
    "spread": "spread", "<spread>": "spread",
    "tickvol": "tickvol", "<tickvol>": "tickvol",
    "vol": "vol", "<vol>": "vol", "volume": "vol", "<volume>": "vol",
}


def _sniff_sep(head: str) -> str:
    counts = {sep: head.count(sep) for sep in ("\t", ";", ",")}
    return max(counts, key=lambda k: counts[k])


def _infer_digits(series: pd.Series) -> int:
    """Nombre de decimales des prix, pour convertir un spread en points."""
    sample = series.dropna().astype(str).head(400)
    best = 0
    for v in sample:
        if "." in v:
            best = max(best, len(v.split(".")[-1].rstrip("0")) or 1)
    return best


def load_mt5_csv(path: str, digits: Optional[int] = None) -> pd.DataFrame:
    """Charge un export de bougies MetaTrader 5.

    Formats acceptes : separateur tabulation / point-virgule / virgule ;
    colonnes <DATE> + <TIME> ou une seule colonne datetime.

    Le spread de l'export MT5 est exprime EN POINTS : il est converti en unites
    de prix via le nombre de decimales (devine, ou fourni par `digits`).
    """
    with io.open(path, encoding="utf-8-sig", errors="replace") as fh:
        head = fh.readline()
    sep = _sniff_sep(head)

    raw = pd.read_csv(path, sep=sep, encoding="utf-8-sig", dtype=str, engine="python")
    raw.columns = [_COLMAP.get(c.strip().lower(), c.strip().lower()) for c in raw.columns]

    if "date" in raw.columns:
        tcol = raw["date"].str.strip()
        if "time" in raw.columns:
            tcol = tcol + " " + raw["time"].str.strip()
        ts = pd.to_datetime(tcol.str.replace(".", "-", regex=False), errors="coerce")
    elif "datetime" in raw.columns:
        ts = pd.to_datetime(raw["datetime"].str.strip(), errors="coerce")
    else:
        raise ValueError(f"{path}: aucune colonne de date reconnue (colonnes: {list(raw.columns)})")

    for col in ("open", "high", "low", "close"):
        if col not in raw.columns:
            raise ValueError(f"{path}: colonne '{col}' absente (colonnes: {list(raw.columns)})")

    inferred = digits if digits is not None else _infer_digits(raw["close"])
    point = 10.0 ** (-inferred) if inferred > 0 else 1.0

    df = pd.DataFrame(index=pd.DatetimeIndex(ts, name="time"))
    for col in ("open", "high", "low", "close"):
        df[col] = pd.to_numeric(raw[col], errors="coerce").to_numpy()
    if "spread" in raw.columns:
        df["spread"] = pd.to_numeric(raw["spread"], errors="coerce").to_numpy() * point

    df = df[~df.index.isna()]
    df = df.dropna(subset=["open", "high", "low", "close"])
    df = df[~df.index.duplicated(keep="last")].sort_index()

    # Garde-fou : des barres incoherentes faussent silencieusement un backtest.
    bad = (df["high"] < df["low"]) | (df["high"] < df["open"]) | (df["high"] < df["close"]) \
        | (df["low"] > df["open"]) | (df["low"] > df["close"])
    if bad.any():
        raise ValueError(f"{path}: {int(bad.sum())} bougies OHLC incoherentes.")

    if len(df) == 0:
        raise ValueError(f"{path}: aucune bougie exploitable apres nettoyage.")
    return df


def load_directory(
    directory: str, symbols: Optional[list] = None
) -> Dict[str, pd.DataFrame]:
    """Charge <directory>/<SYMBOLE>.csv pour chaque symbole trouve."""
    out: Dict[str, pd.DataFrame] = {}
    if not os.path.isdir(directory):
        raise FileNotFoundError(f"Repertoire introuvable : {directory}")
    for fname in sorted(os.listdir(directory)):
        m = re.match(r"^(.+)\.(csv|txt|tsv)$", fname, flags=re.I)
        if not m:
            continue
        sym = m.group(1).upper()
        if symbols and sym not in [s.upper() for s in symbols]:
            continue
        out[sym] = load_mt5_csv(os.path.join(directory, fname))
    if not out:
        raise FileNotFoundError(f"Aucun CSV exploitable dans {directory}")
    return out


# ---------------------------------------------------------------------------
# Series synthetiques (validation du moteur uniquement)
# ---------------------------------------------------------------------------


def synth_bars(
    n_bars: int,
    start_price: float = 100.0,
    bar_hours: int = 4,
    annual_vol: float = 0.30,
    trend: str = "regime",
    regime_len: int = 2200,
    trend_sharpe: float = 0.8,
    seed: int = 0,
    spread_frac: float = 0.0002,
    start: str = "2015-01-01",
    substeps: int = 128,
) -> pd.DataFrame:
    """Genere des bougies OHLC synthetiques.

    trend="random" : marche aleatoire pure, sans derive. Une strategie de suivi
                     de tendance doit y perdre approximativement ses couts.
    trend="regime" : derive alternant +mu / -mu par blocs persistants. Une
                     strategie de suivi de tendance doit y gagner.

    `substeps` est le nombre de pas intra-bougie, et sa valeur n'est PAS un
    detail de performance. Mesure faite dans ce projet, sur une martingale ou
    l'esperance par trade doit valoir zero :

        sous-pas    amplitude moyenne    E[R] mesure
               8               0.790%    +0.0764  (2.6 ecarts-types)
              32               0.899%    +0.0095  (0.4)
             128               0.960%    -0.0082  (0.3)
            2048               1.006%    -0.0169  (0.7)

    Avec trop peu de sous-pas, le high/low enregistre sous-estime l'amplitude
    du vrai chemin continu (-21% a 8 sous-pas). Des stops qui auraient du etre
    touches sont donc MANQUES, les pertes correspondantes disparaissent, et la
    strategie semble extraire du rendement d'une martingale - ce qui est
    impossible. Au-dela de 32 sous-pas, E[R] redevient indiscernable de zero,
    conformement au theoreme d'arret optionnel.

    `regime_len` vaut 2200 bougies H4 par defaut, soit environ un an. Ce n'est
    pas arbitraire : le filtre de regime de la strategie est une EMA 200 en
    journalier, donc elle ne peut capter que des tendances durant bien plus de
    200 jours. Des regimes plus courts produisent un test ou la strategie a
    structurellement tort, ce qui ne mesure rien.
    """
    rng = np.random.default_rng(seed)
    bars_per_year = 365 * 24 / bar_hours
    sigma_bar = annual_vol / np.sqrt(bars_per_year)

    if trend == "random":
        mu_bar = np.zeros(n_bars)
    elif trend == "regime":
        mu_annual = trend_sharpe * annual_vol
        mu = mu_annual / bars_per_year
        signs = np.empty(n_bars)
        i = 0
        s = 1.0
        while i < n_bars:
            block = max(10, int(rng.normal(regime_len, regime_len * 0.3)))
            signs[i : i + block] = s
            i += block
            s = -s if rng.random() < 0.5 else s
        mu_bar = mu * signs[:n_bars]
    else:
        raise ValueError(f"trend inconnu : {trend!r}")

    sig_sub = sigma_bar / np.sqrt(substeps)

    # Correction martingale, indispensable pour que le test ait un sens.
    #
    # Un mouvement brownien geometrique a derive LOG nulle a une derive de PRIX
    # positive : E[S_t] = S_0 * exp(sigma^2 t / 2). Sans la corriger, le marche
    # dit "aleatoire" monte tout seul (mesure : +9% sur 2,7 ans a 30% de vol) et
    # une strategie a biais long y gagne sans aucun edge reel - ce qui invalide
    # completement le test. On retranche sigma^2/2 pour que le PRIX soit une
    # martingale : la seule derive restante est celle qu'on injecte via mu_bar.
    mu_sub = mu_bar / substeps - 0.5 * sig_sub ** 2

    shocks = rng.normal(0.0, sig_sub, size=(n_bars, substeps)) + mu_sub[:, None]
    log_path = np.cumsum(shocks.reshape(-1))
    prices = start_price * np.exp(log_path)
    grid = prices.reshape(n_bars, substeps)

    opens = np.concatenate([[start_price], grid[:-1, -1]])
    closes = grid[:, -1]
    highs = np.maximum(grid.max(axis=1), np.maximum(opens, closes))
    lows = np.minimum(grid.min(axis=1), np.minimum(opens, closes))

    idx = pd.date_range(start=start, periods=n_bars, freq=f"{bar_hours}h")
    df = pd.DataFrame(
        {
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "spread": closes * spread_frac,
        },
        index=idx,
    )
    df.index.name = "time"
    return df


def correlation_report(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Matrice de correlation des rendements journaliers.

    Sert a mesurer, au lieu de supposer, a quel point le panier est diversifie.
    """
    series = {}
    for sym, df in data.items():
        daily = df["close"].resample("1D").last().dropna()
        series[sym] = daily.pct_change()
    frame = pd.DataFrame(series).dropna(how="any")
    return frame.corr()


def effective_bets(corr: pd.DataFrame) -> float:
    """Nombre de paris independants equivalents, via les valeurs propres.

    Mesure = somme(lambda)^2 / somme(lambda^2) sur la matrice de correlation.
    Vaut N si les actifs sont decorreles, et tend vers 1 s'ils sont tous
    parfaitement correles.
    """
    if corr.empty or len(corr) < 2:
        return float(len(corr))
    eig = np.linalg.eigvalsh(corr.to_numpy())
    eig = np.clip(eig, 0.0, None)
    denom = float((eig ** 2).sum())
    return float(eig.sum() ** 2 / denom) if denom > 1e-12 else float(len(corr))
