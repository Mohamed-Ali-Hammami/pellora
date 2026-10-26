#!/usr/bin/env python3
"""
Test de tools/collect.py : le regulateur de debit, mesure au chronometre.

    python3 tools/tests/test_collect.py

Un regulateur qu'on n'a pas chronometre n'est pas un regulateur, c'est une
intention. Ce test monte donc un vrai serveur HTTP sur la machine, lance de
vraies requetes a travers la greffe, et verifie le TEMPS ECOULE.

Ce qu'il etablit :
  — le seau a jetons tient la cadence demandee ;
  — la rafale initiale est autorisee, puis la cadence reprend ;
  — deux hotes ne se freinent pas l'un l'autre ;
  — un 429 avec Retry-After met l'hote au coin pour la duree annoncee ;
  — sans Retry-After, la punition double a chaque refus consecutif ;
  — robots.txt est respecte : Disallow ecarte l'URL, Crawl-delay ralentit ;
  — la greffe attrape bien les requetes emises DEPUIS scrape.py, et pas
    seulement celles de l'orchestrateur.
"""

from __future__ import annotations

import importlib.util
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Le proxy de l'environnement ne doit pas s'interposer sur localhost.
os.environ["no_proxy"] = "127.0.0.1,localhost"
os.environ["NO_PROXY"] = "127.0.0.1,localhost"

RACINE = Path(__file__).resolve().parents[2]


def importe(nom: str):
    spec = importlib.util.spec_from_file_location(nom, RACINE / "tools" / f"{nom}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


collect = importe("collect")
scrape = importe("scrape")

echecs: list[str] = []


def verifie(intitule: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  ok   {intitule}" + (f"  ({detail})" if detail else ""))
    else:
        print(f"  ÉCHEC {intitule}  {detail}")
        echecs.append(intitule)


def proche(intitule: str, obtenu: float, attendu: float, marge: float) -> None:
    verifie(
        intitule,
        abs(obtenu - attendu) <= marge,
        f"{obtenu:.2f} s, attendu {attendu:.2f} ± {marge:.2f}",
    )


# ─────────────────────────── serveur de test ───────────────────────────

PAGE = (
    '<html><head><title>T</title><script type="application/ld+json">'
    '{"@type":"Product","name":"Article de test","description":"Une description assez '
    'longue pour franchir le seuil des quatre-vingts caracteres exige par le script.",'
    '"image":["http://exemple.invalid/x.jpg"],'
    '"offers":{"@type":"Offer","price":"19.90","priceCurrency":"EUR"}}'
    "</script></head><body></body></html>"
)

ROBOTS_INTERDIT = "User-agent: *\nDisallow: /prive/\n"
ROBOTS_LENT = "User-agent: *\nCrawl-delay: 2\n"


class Serveur(BaseHTTPRequestHandler):
    robots = "User-agent: *\nAllow: /\n"
    refus_restants = 0
    retry_after: str | None = None
    appels: list[float] = []

    def do_GET(self) -> None:  # noqa: N802
        Serveur.appels.append(time.monotonic())

        if self.path == "/robots.txt":
            corps = Serveur.robots.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(corps)))
            self.end_headers()
            self.wfile.write(corps)
            return

        if Serveur.refus_restants > 0:
            Serveur.refus_restants -= 1
            self.send_response(429)
            if Serveur.retry_after:
                self.send_header("Retry-After", Serveur.retry_after)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        corps = PAGE.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def log_message(self, *_: object) -> None:
        pass


def demarre() -> tuple[ThreadingHTTPServer, str]:
    serveur = ThreadingHTTPServer(("127.0.0.1", 0), Serveur)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur, f"http://127.0.0.1:{serveur.server_address[1]}"


def neuf(rps: float, burst: float, robots: bool = False, agent: str = "test") -> collect.Regulateur:
    """Un régulateur propre, greffé sur urlopen."""
    # On restaure l'original avant de regreffer, sinon les greffes s'empilent
    # et chaque test hériterait des limites du précédent.
    global _ORIGINAL
    urllib.request.urlopen = _ORIGINAL  # type: ignore[assignment]
    r = collect.Regulateur(rps=rps, burst=burst, respecte_robots=robots, agent=agent, bavard=False)
    collect.greffe(r)
    return r


_ORIGINAL = urllib.request.urlopen
serveur, base = demarre()


def demande(url: str) -> int:
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=10) as r:
            r.read()
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


# ═══════════════════════ le seau a jetons ═══════════════════════

print("\ncadence tenue")
neuf(rps=5.0, burst=1.0)
debut = time.monotonic()
for _ in range(6):
    demande(f"{base}/p")
# 1 jeton d'avance, puis 5 à 5/s = 1,0 s.
proche("6 requêtes à 5/s (rafale 1)", time.monotonic() - debut, 1.0, 0.35)

neuf(rps=2.0, burst=1.0)
debut = time.monotonic()
for _ in range(3):
    demande(f"{base}/p")
proche("3 requêtes à 2/s (rafale 1)", time.monotonic() - debut, 1.0, 0.3)

print("\nrafale initiale")
neuf(rps=1.0, burst=5.0)
debut = time.monotonic()
for _ in range(5):
    demande(f"{base}/p")
ecoule = time.monotonic() - debut
verifie("5 requêtes immédiates avec rafale 5", ecoule < 0.5, f"{ecoule:.2f} s")
debut = time.monotonic()
demande(f"{base}/p")
proche("la 6ᵉ attend la cadence", time.monotonic() - debut, 1.0, 0.3)

# ═══════════════════ independance entre hotes ═══════════════════

print("\nindépendance des hôtes")
serveur2, base2 = demarre()
r = neuf(rps=1.0, burst=1.0)
demande(f"{base}/p")   # consomme le jeton de l'hôte 1
demande(f"{base2}/p")  # hôte 2 a son propre seau
debut = time.monotonic()
demande(f"{base2}/p")  # attend 1 s sur l'hôte 2 seulement
attente_hote2 = time.monotonic() - debut
proche("chaque hôte a son propre seau", attente_hote2, 1.0, 0.3)
verifie("deux hôtes suivis séparément", len([h for h in r._hotes.values() if h.requetes]) == 2)

# ═══════════════════════ 429 et Retry-After ═══════════════════════

print("\nréaction au 429")
r = neuf(rps=100.0, burst=100.0)
Serveur.refus_restants = 1
Serveur.retry_after = "2"
debut = time.monotonic()
verifie("le 429 est bien remonté", demande(f"{base}/p") == 429)
demande(f"{base}/p")
proche("Retry-After: 2 respecté", time.monotonic() - debut, 2.0, 0.5)
Serveur.retry_after = None

r = neuf(rps=100.0, burst=100.0)
h = r.hote(base.replace("http://", ""))
r.punit(h, None)
premiere = h.penalite_jusqua - time.monotonic()
r.punit(h, None)
seconde = h.penalite_jusqua - time.monotonic()
verifie("sans Retry-After, la punition double", seconde > premiere * 1.8,
        f"{premiere:.0f} s puis {seconde:.0f} s")
r.pardonne(h)
verifie("un succès remet le compteur à zéro", h.refus_consecutifs == 0)

r = neuf(rps=100.0, burst=100.0)
h = r.hote("x")
for _ in range(20):
    r.punit(h, None)
verifie("la punition est plafonnée", h.penalite_jusqua - time.monotonic() <= r.PENALITE_MAX + 1,
        f"{h.penalite_jusqua - time.monotonic():.0f} s ≤ {r.PENALITE_MAX:.0f} s")
verifie("Retry-After en forme de date ne casse rien", (r.punit(h, "Wed, 21 Oct 2026 07:28:00 GMT"), True)[1])

# ═══════════════════════════ robots.txt ═══════════════════════════

print("\nrobots.txt")
Serveur.robots = ROBOTS_INTERDIT
r = neuf(rps=100.0, burst=100.0, robots=True)
verifie("Disallow écarte l'URL", not r.autorise(f"{base}/prive/x"))
verifie("le reste passe", r.autorise(f"{base}/public/x"))
leve = False
try:
    demande(f"{base}/prive/x")
except collect.Interdit:
    leve = True
verifie("la greffe lève Interdit", leve)

Serveur.robots = ROBOTS_LENT
r = neuf(rps=100.0, burst=1.0, robots=True)
r.autorise(f"{base}/p")  # déclenche la lecture de robots.txt
h = r.hote(base.replace("http://", ""))
verifie("Crawl-delay: 2 écrase --rps", abs(h.rps - 0.5) < 0.01, f"{h.rps:.2f} req/s")

r = neuf(rps=0.2, burst=1.0, robots=True)
r.autorise(f"{base}/p")
h = r.hote(base.replace("http://", ""))
verifie("un Crawl-delay plus RAPIDE ne nous accélère pas", abs(h.rps - 0.2) < 0.01,
        f"{h.rps:.2f} req/s, --rps conservé")

print("\nrobots.txt refusé : règle ou illisible ?")
Serveur.robots = "User-agent: *\nAllow: /\n"
serveur3, base3 = demarre()


class Refus(Serveur):
    """Un hôte qui refuse jusqu'à son robots.txt, comme derrière un filtre."""

    def do_GET(self) -> None:  # noqa: N802
        self.send_response(403)
        self.send_header("Content-Length", "0")
        self.end_headers()


serveur4 = ThreadingHTTPServer(("127.0.0.1", 0), Refus)
threading.Thread(target=serveur4.serve_forever, daemon=True).start()
base4 = f"http://127.0.0.1:{serveur4.server_address[1]}"

r = neuf(rps=100.0, burst=100.0, robots=True)
permis, raison = r.verdict(f"{base4}/p/1")
verifie("un 403 sur robots.txt bloque quand même", permis is False)
verifie(
    "et la raison dit « inaccessible », pas « interdit ce chemin »",
    raison is not None and "inaccessible" in raison and "403" in raison,
    str(raison),
)

Serveur.robots = "User-agent: *\nDisallow: /prive/\n"
r = neuf(rps=100.0, burst=100.0, robots=True)
permis, raison = r.verdict(f"{base3}/prive/x")
verifie("une vraie règle bloque aussi", permis is False)
verifie(
    "et la raison dit « ce chemin »",
    raison is not None and "ce chemin" in raison,
    str(raison),
)

Serveur.robots = "User-agent: *\nAllow: /\n"

# ═════════════ la greffe attrape aussi scrape.py ═════════════

print("\nla greffe couvre les scripts, pas seulement l'orchestrateur")
neuf(rps=2.0, burst=1.0)
debut = time.monotonic()
for _ in range(3):
    page, raison = scrape.recupere(f"{base}/p", essais=1)
ecoule = time.monotonic() - debut
verifie("scrape.recupere ramène la page", page is not None and "Article de test" in (page or ""))
proche("et il est régulé comme le reste", ecoule, 1.0, 0.35)

res = scrape.analyse(page or "", f"{base}/p")
verifie("extraction de bout en bout", res.get("titre") == "Article de test" and res.get("prix") == 19.90,
        f"{res.get('titre')} / {res.get('prix')}")

# ═════════════════════════ le journal ═════════════════════════

print("\njournal et reprise")
import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as tmp:
    chemin = Path(tmp) / "j.jsonl"
    j = collect.Journal(chemin)
    j.ajoute("page:a", {"ok": True, "titre": "A"})
    j.ajoute("page:b", {"ok": False, "raison": "x"})
    verifie("écrit ligne par ligne", len(chemin.read_text(encoding="utf-8").strip().splitlines()) == 2)

    relu = collect.Journal(chemin)
    verifie("relit les clefs déjà faites", relu.deja == {"page:a", "page:b"})
    verifie("relit les enregistrements", len(relu.tout()) == 2)

    with chemin.open("a", encoding="utf-8") as f:
        f.write("{ ligne tronquée par une coupure\n")
    abime = collect.Journal(chemin)
    verifie("une ligne tronquée ne casse pas la reprise", abime.deja == {"page:a", "page:b"})

urllib.request.urlopen = _ORIGINAL  # type: ignore[assignment]
serveur.shutdown()
serveur2.shutdown()
serveur3.shutdown()
serveur4.shutdown()

print()
if echecs:
    print(f"{len(echecs)} échec(s) : {', '.join(echecs)}")
    raise SystemExit(1)
print("tout passe.")
