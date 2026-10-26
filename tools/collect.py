#!/usr/bin/env python3
"""
Orchestrateur : pilote scrape.py et images.py sous un regulateur de debit.

    python3 tools/collect.py --urls urls.txt
    python3 tools/collect.py --urls urls.txt --images-manquantes
    python3 tools/collect.py --requetes mots-cles.txt --rps 0.5
    python3 tools/collect.py --urls urls.txt --rps 1 --concurrence 4 --reprendre

COMMENT LE DEBIT EST REELLEMENT TENU.

Le point de passage oblige de tout le trafic des deux scripts est
`urllib.request.urlopen`. L'orchestrateur le remplace UNE fois, au demarrage,
par une version qui passe par un regulateur. Les deux scripts restent
inchanges et ne savent rien de tout ca : il n'y a donc aucun chemin par lequel
une requete pourrait echapper a la limite, pas meme une requete ajoutee plus
tard dans scrape.py.

Ce que le regulateur applique, par HOTE et non globalement — deux domaines
differents n'ont aucune raison de se freiner l'un l'autre :

  seau a jetons        `--rps` requetes par seconde en regime etabli,
                       `--burst` d'avance au demarrage. Un seau, et non un
                       simple `sleep` entre deux appels : cela autorise une
                       rafale courte apres une periode calme, ce qui est le
                       comportement qu'un serveur tolere le mieux.
  un seul appel a la fois  un verrou par hote. La concurrence joue ENTRE
                       hotes, jamais sur un seul — c'est ce qui distingue un
                       collecteur poli d'une attaque par deni de service.
  robots.txt           lu une fois par hote, puis respecte : `Disallow`
                       ecarte l'URL, et `Crawl-delay` ECRASE `--rps` s'il est
                       plus lent. Le site a le dernier mot sur sa cadence.
  429 et 503           l'en-tete `Retry-After` est lu et l'hote est mis au
                       coin pour cette duree. A defaut d'en-tete, le delai
                       double a chaque refus consecutif, jusqu'a 5 minutes.
                       Chaque succes le remet a zero.

REPRISE. Chaque resultat est ajoute a un journal au format JSONL, ligne par
ligne, des qu'il arrive. Une interruption — Ctrl-C, coupure reseau, machine
qui s'eteint — ne perd que la page en cours, et `--reprendre` saute tout ce
qui est deja au journal.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import signal
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ICI = Path(__file__).resolve().parent


def importe(nom: str):
    """Charge un script voisin comme module, sans paquet ni installation."""
    spec = importlib.util.spec_from_file_location(nom, ICI / f"{nom}.py")
    if not spec or not spec.loader:
        raise SystemExit(f"introuvable : {ICI / (nom + '.py')}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ════════════════════════════ le regulateur ════════════════════════════


class Hote:
    """L'etat d'un domaine : son seau a jetons, son verrou, sa punition."""

    def __init__(self, rps: float, burst: float) -> None:
        self.verrou = threading.Lock()
        self.rps = rps
        self.jetons = burst
        self.burst = burst
        self.dernier = time.monotonic()
        self.penalite_jusqua = 0.0
        self.refus_consecutifs = 0
        self.robots: urllib.robotparser.RobotFileParser | None = None
        self.robots_lus = False
        self.requetes = 0
        self.refus = 0
        # Fenetre d'activite propre a cet hote, pour un debit moyen honnete :
        # diviser par le temps ecoule depuis le demarrage du programme
        # melangerait les hotes et les periodes d'inactivite.
        self.premiere: float | None = None
        self.derniere: float = 0.0


class Regulateur:
    """Un seau a jetons par hote, un verrou par hote, robots.txt par hote."""

    PENALITE_MAX = 300.0

    def __init__(
        self,
        rps: float,
        burst: float,
        respecte_robots: bool,
        agent: str,
        bavard: bool = True,
    ) -> None:
        self.rps_defaut = rps
        self.burst = burst
        self.respecte_robots = respecte_robots
        self.agent = agent
        self.bavard = bavard
        self._hotes: dict[str, Hote] = {}
        self._creation = threading.Lock()
        self.attente_totale = 0.0
        self.debut = time.monotonic()

    def hote(self, nom: str) -> Hote:
        with self._creation:
            if nom not in self._hotes:
                self._hotes[nom] = Hote(self.rps_defaut, self.burst)
            return self._hotes[nom]

    # ─────────────────────────── robots.txt ───────────────────────────

    def _charge_robots(self, h: Hote, schema: str, nom: str) -> None:
        """Lu une seule fois par hote, et hors de toute limite de debit.

        Un robots.txt n'est pas une page a collecter : le faire passer par le
        seau a jetons retarderait la premiere requete utile sans raison.
        """
        if h.robots_lus or not self.respecte_robots:
            h.robots_lus = True
            return
        h.robots_lus = True
        lecteur = urllib.robotparser.RobotFileParser()
        lecteur.set_url(f"{schema}://{nom}/robots.txt")
        try:
            lecteur.read()
            h.robots = lecteur
            delai = lecteur.crawl_delay(self.agent)
            if delai:
                # Le site impose sa cadence quand elle est plus lente que la
                # notre. Jamais l'inverse : un Crawl-delay court n'autorise pas
                # a aller plus vite que ce que l'operateur a demande.
                impose = 1.0 / float(delai)
                if impose < h.rps:
                    h.rps = impose
                    if self.bavard:
                        print(f"  [{nom}] robots.txt impose {delai} s entre deux requêtes")
        except Exception:  # noqa: BLE001 — pas de robots.txt, ou illisible
            h.robots = None

    def autorise(self, url: str) -> bool:
        if not self.respecte_robots:
            return True
        morceaux = urllib.parse.urlsplit(url)
        h = self.hote(morceaux.netloc)
        self._charge_robots(h, morceaux.scheme or "https", morceaux.netloc)
        if h.robots is None:
            return True
        try:
            return h.robots.can_fetch(self.agent, url)
        except Exception:  # noqa: BLE001
            return True

    # ─────────────────────────── le passage ───────────────────────────

    def _jeton(self, h: Hote) -> float:
        """Attente a observer avant le prochain appel sur cet hote."""
        maintenant = time.monotonic()

        punition = h.penalite_jusqua - maintenant
        if punition > 0:
            return punition

        h.jetons = min(h.burst, h.jetons + (maintenant - h.dernier) * h.rps)
        h.dernier = maintenant
        if h.jetons >= 1.0:
            h.jetons -= 1.0
            return 0.0
        return (1.0 - h.jetons) / h.rps

    def attends(self, url: str) -> Hote:
        """Bloque jusqu'a ce que cet hote accepte une requete de plus."""
        h = self.hote(urllib.parse.urlsplit(url).netloc)
        while True:
            with h.verrou:
                attente = self._jeton(h)
                if attente <= 0:
                    h.requetes += 1
                    maintenant = time.monotonic()
                    if h.premiere is None:
                        h.premiere = maintenant
                    h.derniere = maintenant
                    return h
            self.attente_totale += attente
            time.sleep(min(attente, 5.0))

    def punit(self, h: Hote, retry_after: str | None) -> None:
        """429 ou 503 : on recule, et on recule plus fort a chaque fois."""
        h.refus += 1
        h.refus_consecutifs += 1
        duree: float | None = None
        if retry_after:
            try:
                duree = float(retry_after.strip())
            except ValueError:
                duree = None  # forme « date HTTP » : on retombe sur le doublement
        if duree is None:
            duree = min(self.PENALITE_MAX, 5.0 * (2 ** (h.refus_consecutifs - 1)))
        h.penalite_jusqua = max(h.penalite_jusqua, time.monotonic() + duree)
        if self.bavard:
            print(f"  [freiné] pause de {duree:.0f} s (refus n°{h.refus_consecutifs})")

    def pardonne(self, h: Hote) -> None:
        h.refus_consecutifs = 0

    def rapport(self) -> list[str]:
        """Debit moyen par hote, mesure sur SA fenetre d'activite.

        Le mesurer depuis le demarrage du programme donnait un chiffre
        trompeur : il incluait le temps passe sur d'autres hotes, et la rafale
        initiale faisait apparaitre une moyenne superieure au plafond. Le
        rapport doit permettre de verifier la limite, pas la faire douter.
        """
        lignes = []
        for nom, h in sorted(self._hotes.items(), key=lambda kv: -kv[1].requetes):
            if h.requetes == 0 or h.premiere is None:
                continue
            fenetre = max(h.derniere - h.premiere, 0.001)
            # Sur la fenetre, la premiere requete est « gratuite » : n
            # requetes s'espacent de n-1 intervalles.
            debit = (h.requetes - 1) / fenetre if h.requetes > 1 else 0.0
            lignes.append(
                f"  {nom[:38]:38} {h.requetes:5} req  {debit:5.2f}/s  "
                f"plafond {h.rps:5.2f}/s  {h.refus} refus  sur {fenetre:5.1f} s"
            )
        return lignes


# ═══════════════════ la greffe sur urllib ═══════════════════


class Interdit(Exception):
    """robots.txt refuse cette URL."""


def greffe(regulateur: Regulateur) -> None:
    """Remplace urlopen par une version regulee, pour tout le processus.

    Les deux scripts appellent `urllib.request.urlopen`. En remplacant la
    fonction a la racine du module, toute requete qu'ils emettent — presente
    ou ajoutee plus tard — passe forcement par le regulateur. Il n'y a pas de
    porte de sortie.
    """
    original = urllib.request.urlopen

    def regule(requete, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        url = requete.full_url if hasattr(requete, "full_url") else str(requete)

        if not regulateur.autorise(url):
            raise Interdit(url)

        h = regulateur.attends(url)
        try:
            reponse = original(requete, *args, **kwargs)
        except urllib.error.HTTPError as erreur:
            if erreur.code in (429, 503):
                regulateur.punit(h, erreur.headers.get("Retry-After"))
            raise
        regulateur.pardonne(h)
        return reponse

    urllib.request.urlopen = regule  # type: ignore[assignment]


# ════════════════════════════ le journal ════════════════════════════


class Journal:
    """Un JSONL en ajout : chaque ligne est un resultat, ecrit des qu'il arrive."""

    def __init__(self, chemin: Path) -> None:
        self.chemin = chemin
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        self._verrou = threading.Lock()
        self.deja: set[str] = set()
        if chemin.exists():
            for ligne in chemin.read_text(encoding="utf-8").splitlines():
                try:
                    objet = json.loads(ligne)
                except json.JSONDecodeError:
                    continue
                clef = objet.get("clef")
                if clef:
                    self.deja.add(clef)

    def ajoute(self, clef: str, charge: dict) -> None:
        with self._verrou:
            with self.chemin.open("a", encoding="utf-8") as f:
                f.write(json.dumps({"clef": clef, **charge}, ensure_ascii=False) + "\n")
            self.deja.add(clef)

    def tout(self) -> list[dict]:
        if not self.chemin.exists():
            return []
        sortie = []
        for ligne in self.chemin.read_text(encoding="utf-8").splitlines():
            try:
                sortie.append(json.loads(ligne))
            except json.JSONDecodeError:
                continue
        return sortie


# ════════════════════════════ les taches ════════════════════════════


ARRET = threading.Event()


def lis_lignes(chemin: str) -> list[str]:
    return [
        l.strip()
        for l in Path(chemin).read_text(encoding="utf-8").splitlines()
        if l.strip() and not l.strip().startswith("#")
    ]


def une_page(scrape, url: str, dossier_images: Path | None, max_images: int) -> dict:
    """Une page : extraction, puis visuels si demandes."""
    page, raison = scrape.recupere(url, essais=2)
    if page is None:
        return {"ok": False, "url": url, "raison": raison or "inconnu"}

    res = scrape.analyse(page, url)
    sortie: dict = {
        "ok": True,
        "url": url,
        "titre": res.get("titre"),
        "prix": res.get("prix"),
        "devise": res.get("devise"),
        "marque": res.get("marque"),
        "sku": res.get("sku"),
        "ean": res.get("ean"),
        "description": res.get("description"),
        "images": res.get("images") or [],
        "methodes": res.get("methodes"),
        "complet": res.get("complet"),
    }

    if dossier_images is not None and sortie["images"] and not ARRET.is_set():
        cible = dossier_images / scrape.nom_dossier(res, url)
        pris = scrape.telecharge(sortie["images"], cible, max_images, 0.0)
        sortie["imagesTelechargees"] = pris
        sortie["dossierImages"] = str(cible)
    return sortie


def une_recherche(images_mod, requete: str, combien: int, mini: int, dossier: Path, telecharge: bool) -> dict:
    moteur, urls = images_mod.cherche(requete, "auto", combien)
    sortie: dict = {"ok": bool(urls), "requete": requete, "moteur": moteur, "urlsTrouvees": len(urls)}
    if urls and telecharge and not ARRET.is_set():
        cible = dossier / images_mod.nom_dossier(requete)
        sortie["images"] = images_mod.recupere_images(urls, cible, combien, mini, 0.0)
        sortie["dossierImages"] = str(cible)
    elif urls:
        sortie["urls"] = urls[:combien]
    return sortie


# ════════════════════════════ principal ════════════════════════════


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)

    quoi = p.add_argument_group("ce qu'il faut collecter")
    quoi.add_argument("--urls", help="fichier d'URL, une par ligne")
    quoi.add_argument("--requetes", help="fichier de mots-clés, un par ligne (recherche d'images)")
    quoi.add_argument("--images-manquantes", action="store_true",
                      help="après les pages, chercher des visuels pour celles qui n'en ont pas")
    quoi.add_argument("--sans-images", action="store_true", help="ne rien télécharger comme visuel")
    quoi.add_argument("--max-images", type=int, default=8, help="visuels par produit (défaut 8)")
    quoi.add_argument("--min-image", type=int, default=600, help="côté minimal en pixels (défaut 600)")

    debit = p.add_argument_group("limites de débit")
    debit.add_argument("--rps", type=float, default=1.0,
                       help="requêtes par seconde et PAR HÔTE (défaut 1)")
    debit.add_argument("--burst", type=float, default=3.0, help="avance autorisée au démarrage (défaut 3)")
    debit.add_argument("--concurrence", type=int, default=4,
                       help="hôtes traités en parallèle (défaut 4 ; un seul appel à la fois par hôte)")
    debit.add_argument("--ignore-robots", action="store_true",
                       help="ne pas lire robots.txt (déconseillé)")

    ou = p.add_argument_group("sortie")
    ou.add_argument("--dossier", default="collect", help="dossier de travail (défaut « collect »)")
    ou.add_argument("--reprendre", action="store_true", help="sauter ce qui est déjà au journal")
    ou.add_argument("--agent", default="collecte-produits/1.0", help="nom déclaré à robots.txt")

    args = p.parse_args()
    if not args.urls and not args.requetes:
        p.print_help()
        return 1

    scrape = importe("scrape")
    images_mod = importe("images")

    regulateur = Regulateur(
        rps=args.rps, burst=args.burst,
        respecte_robots=not args.ignore_robots,
        agent=args.agent,
    )
    greffe(regulateur)

    racine = Path(args.dossier)
    journal = Journal(racine / "journal.jsonl")
    dossier_images = None if args.sans_images else racine / "images"

    def sur_interruption(*_: object) -> None:
        if ARRET.is_set():
            print("\n(deuxième interruption : arrêt immédiat)")
            raise SystemExit(130)
        ARRET.set()
        print("\nArrêt demandé — les pages en cours se terminent, le journal est à jour.")

    signal.signal(signal.SIGINT, sur_interruption)

    print()
    print(f"  débit        {args.rps} req/s par hôte, rafale {args.burst}")
    print(f"  concurrence  {args.concurrence} hôte(s) en parallèle, 1 appel à la fois par hôte")
    print(f"  robots.txt   {'ignoré' if args.ignore_robots else 'respecté'}")
    print(f"  journal      {journal.chemin}" + (f" ({len(journal.deja)} déjà fait)" if journal.deja else ""))
    print()

    # ─── les pages ───
    resultats_pages: list[dict] = []
    if args.urls:
        urls = lis_lignes(args.urls)
        a_faire = [u for u in urls if not (args.reprendre and f"page:{u}" in journal.deja)]
        saute = len(urls) - len(a_faire)
        print(f"{len(a_faire)} page(s) à collecter" + (f", {saute} sautée(s)" if saute else ""))

        faits = 0
        with ThreadPoolExecutor(max_workers=args.concurrence) as pool:
            taches = {
                pool.submit(une_page, scrape, u, dossier_images, args.max_images): u
                for u in a_faire
            }
            for tache in as_completed(taches):
                url = taches[tache]
                if ARRET.is_set():
                    tache.cancel()
                try:
                    res = tache.result()
                except Interdit:
                    res = {"ok": False, "url": url, "raison": "robots.txt interdit"}
                except Exception as erreur:  # noqa: BLE001
                    res = {"ok": False, "url": url, "raison": f"{type(erreur).__name__}: {erreur}"}
                journal.ajoute(f"page:{url}", res)
                resultats_pages.append(res)
                faits += 1
                etat = "✓" if res.get("ok") else "✗"
                detail = (
                    f"{(res.get('titre') or '')[:46]:46} {res.get('prix') or '—':>9} "
                    f"{len(res.get('images') or []):2} img"
                    if res.get("ok") else res.get("raison", "")
                )
                print(f"  [{faits}/{len(a_faire)}] {etat} {detail}")

    # ─── les recherches d'images ───
    requetes: list[str] = []
    if args.requetes:
        requetes += lis_lignes(args.requetes)
    if args.images_manquantes:
        # On ne cherche que pour ce qui a un titre mais aucun visuel : sans
        # titre, la requete serait vide et ramenerait n'importe quoi.
        for res in resultats_pages:
            if res.get("ok") and res.get("titre") and not res.get("images"):
                requetes.append(res["titre"])

    resultats_recherches: list[dict] = []
    if requetes and not ARRET.is_set():
        a_faire = [r for r in requetes if not (args.reprendre and f"img:{r}" in journal.deja)]
        print()
        print(f"{len(a_faire)} recherche(s) d'images")
        faits = 0
        with ThreadPoolExecutor(max_workers=args.concurrence) as pool:
            taches = {
                pool.submit(
                    une_recherche, images_mod, r, args.max_images,
                    args.min_image, racine / "recherche", not args.sans_images,
                ): r
                for r in a_faire
            }
            for tache in as_completed(taches):
                requete = taches[tache]
                if ARRET.is_set():
                    tache.cancel()
                try:
                    res = tache.result()
                except Exception as erreur:  # noqa: BLE001
                    res = {"ok": False, "requete": requete, "raison": f"{type(erreur).__name__}"}
                journal.ajoute(f"img:{requete}", res)
                resultats_recherches.append(res)
                faits += 1
                etat = "✓" if res.get("ok") else "✗"
                combien = len(res.get("images") or res.get("urls") or [])
                print(f"  [{faits}/{len(a_faire)}] {etat} {requete[:52]:52} {res.get('moteur', '—'):8} {combien} img")

    # ─── consolidation ───
    tout = journal.tout()
    pages = [l for l in tout if str(l.get("clef", "")).startswith("page:")]
    recherches = [l for l in tout if str(l.get("clef", "")).startswith("img:")]
    sortie = racine / "donnees.json"
    sortie.write_text(
        json.dumps(
            {
                "_meta": {
                    "pages": len(pages),
                    "pagesCompletes": sum(1 for l in pages if l.get("complet")),
                    "recherches": len(recherches),
                    "debitParHote": args.rps,
                    "robotsRespectes": not args.ignore_robots,
                },
                "pages": pages,
                "recherches": recherches,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    echecs = [l for l in pages if not l.get("ok")]
    print()
    print("  RÉSULTAT")
    print(f"    pages collectées    {len(pages) - len(echecs):5} / {len(pages)}")
    print(f"    dont complètes      {sum(1 for l in pages if l.get('complet')):5}")
    if recherches:
        print(f"    recherches d'images {len(recherches):5}")
    if echecs:
        print(f"    échecs              {len(echecs):5}")
    print()
    print("  DÉBIT TENU")
    for ligne in regulateur.rapport():
        print(ligne)
    if regulateur.attente_totale > 1:
        # Somme sur tous les fils d'execution : depasse donc le temps reel
        # quand plusieurs hotes sont traites en parallele.
        print(f"    attente imposée, cumulée sur les fils : {regulateur.attente_totale:.0f} s")
    print()
    print(f"  → {sortie}")
    print(f"  → {journal.chemin} (reprise avec --reprendre)")

    if echecs:
        print()
        raisons: dict[str, int] = defaultdict(int)
        for l in echecs:
            raisons[str(l.get("raison"))[:50]] += 1
        for raison, combien in sorted(raisons.items(), key=lambda kv: -kv[1])[:8]:
            print(f"    {combien:4} × {raison}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
