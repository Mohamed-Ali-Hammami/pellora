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


def console_en_utf8() -> None:
    """Force la sortie en UTF-8, sans jamais faire echouer l'execution.

    La console Windows est en cp1252 par defaut. Un « ✓ », un « é » ou un
    nom de produit espagnol y leve UnicodeEncodeError, et le programme meurt
    sur l'affichage d'un resultat qu'il avait pourtant obtenu. `errors` a
    « replace » vaut mieux que ca : un caractere remplace par « ? » se lit
    encore, un plantage non.
    """
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError, OSError):
            pass


console_en_utf8()


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
        # Pourquoi robots.txt bloque, le cas echeant. La distinction compte
        # pour le diagnostic : une REGLE qui interdit un chemin et un
        # robots.txt ILLISIBLE ne disent pas la meme chose, et Python les
        # confond — `RobotFileParser.read()` met tout en interdit quand la
        # lecture rend 401 ou 403.
        self.robots_raison: str | None = None
        self.requetes = 0
        self.refus = 0
        # Fenetre d'activite propre a cet hote, pour un debit moyen honnete :
        # diviser par le temps ecoule depuis le demarrage du programme
        # melangerait les hotes et les periodes d'inactivite.
        self.premiere: float | None = None
        self.derniere: float = 0.0
        # Requetes emises par les PAGES elles-memes lors d'un rendu
        # navigateur. Comptees a part : le seau ne les regule pas, mais les
        # cacher laisserait croire a un debit quatre fois plus faible que le
        # debit reel.
        self.sous_requetes = 0


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
        # `greffe()` y depose le urlopen d'origine. Le diagnostic de
        # robots.txt doit l'utiliser : passer par la version greffee le ferait
        # refuser par notre propre controle robots — qui vient justement de
        # tout interdire — et on n'apprendrait jamais le code HTTP.
        self.urlopen_direct = urllib.request.urlopen
        self.attente_totale = 0.0
        self.debut = time.monotonic()

    def hote(self, nom: str) -> Hote:
        with self._creation:
            if nom not in self._hotes:
                self._hotes[nom] = Hote(self.rps_defaut, self.burst)
            return self._hotes[nom]

    # ─────────────────────────── robots.txt ───────────────────────────

    def _charge_robots(self, h: Hote, schema: str, nom: str) -> None:
        """Lu une seule fois par hote.

        La lecture consomme un jeton comme n'importe quelle requete :
        `RobotFileParser.read()` appelle `urlopen`, donc la greffe. C'est
        voulu — robots.txt est une requete vers l'hote, elle a sa place dans
        son budget.

        `robots_lus` est mis a True AVANT la lecture, et ce n'est pas un
        detail : sans cela, la requete vers robots.txt repasserait par
        `autorise()`, qui rappellerait cette methode, qui relirait robots.txt.
        Recursion infinie des la premiere URL.
        """
        if h.robots_lus or not self.respecte_robots:
            h.robots_lus = True
            return
        h.robots_lus = True
        lecteur = urllib.robotparser.RobotFileParser()
        adresse = f"{schema}://{nom}/robots.txt"
        lecteur.set_url(adresse)
        try:
            lecteur.read()
            h.robots = lecteur
            if getattr(lecteur, "disallow_all", False):
                # `read()` avale l'erreur HTTP et pose `disallow_all`. On
                # refait donc la demande pour connaitre le code, sinon le
                # rapport dirait « robots.txt interdit » alors que le vrai
                # probleme est qu'on n'a pas pu le lire.
                h.robots_raison = "robots.txt illisible (tout est donc considéré interdit)"
                try:
                    self.urlopen_direct(
                        urllib.request.Request(adresse, headers={"User-Agent": self.agent}),
                        timeout=15,
                    ).close()
                except urllib.error.HTTPError as erreur:
                    h.robots_raison = (
                        f"robots.txt inaccessible (HTTP {erreur.code}) — "
                        "tout est donc considéré interdit"
                    )
                except Exception:  # noqa: BLE001
                    pass
                if self.bavard:
                    print(f"  [{nom}] {h.robots_raison}")
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
        return self.verdict(url)[0]

    def verdict(self, url: str) -> tuple[bool, str | None]:
        """(autorise, raison du refus). La raison sert au diagnostic."""
        if not self.respecte_robots:
            return True, None
        morceaux = urllib.parse.urlsplit(url)
        h = self.hote(morceaux.netloc)
        self._charge_robots(h, morceaux.scheme or "https", morceaux.netloc)
        if h.robots is None:
            return True, None
        try:
            if h.robots.can_fetch(self.agent, url):
                return True, None
        except Exception:  # noqa: BLE001
            return True, None
        return False, h.robots_raison or "robots.txt interdit ce chemin"

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

    def note_sous_requetes(self, h: Hote, combien: int) -> None:
        """Requetes qu'une page a emises d'elle-meme pendant son rendu."""
        if combien > 1:
            # La navigation elle-meme est deja comptee dans `requetes` : on
            # n'ajoute que ce qui s'y ajoute.
            h.sous_requetes += combien - 1

    def rapport(self) -> list[str]:
        """Pour chaque hote : ce qui a ete envoye, et ce qui etait autorise.

        Deux versions precedentes affichaient un debit moyen, et toutes deux
        donnaient un chiffre superieur au plafond sans qu'aucune limite ait
        ete franchie — d'abord parce que la fenetre incluait les autres
        hotes, ensuite parce qu'une rafale de 3 sur une demi-seconde fait
        forcement une moyenne de 8/s. Une moyenne ne peut pas decrire un seau
        a jetons : elle lisse justement ce que le seau autorise.

        Le rapport annonce donc ce qui est verifiable : le nombre de requetes
        envoyees, et le nombre que le seau permettait sur la meme duree, soit
        `rafale + debit x duree`. La ligne se lit alors sans interpretation —
        « 5 sur 5 autorisees » dit tout, et un depassement sauterait aux yeux.
        """
        lignes = []
        for nom, h in sorted(self._hotes.items(), key=lambda kv: -kv[1].requetes):
            if h.requetes == 0 or h.premiere is None:
                continue
            fenetre = max(h.derniere - h.premiere, 0.0)
            autorise = int(h.burst + h.rps * fenetre)
            verdict = "conforme" if h.requetes <= autorise else "DÉPASSEMENT"
            lignes.append(
                f"  {nom[:34]:34} {h.requetes:4} nav en {fenetre:5.1f} s  "
                f"({autorise} autorisées : rafale {h.burst:.0f} + {h.rps:.2f}/s)  "
                f"{h.refus} refus  {verdict}"
            )
            if h.sous_requetes:
                total = h.requetes + h.sous_requetes
                lignes.append(
                    f"  {'':34} + {h.sous_requetes:4} requête(s) émise(s) par les pages "
                    f"→ {total} au total, soit {total / max(fenetre, 0.001):.2f}/s réel"
                )
        return lignes


# ═══════════════════ la greffe sur urllib ═══════════════════


class Interdit(Exception):
    """robots.txt refuse cette URL — le message dit pourquoi."""


def greffe(regulateur: Regulateur) -> None:
    """Remplace urlopen par une version regulee, pour tout le processus.

    Les deux scripts appellent `urllib.request.urlopen`. En remplacant la
    fonction a la racine du module, toute requete qu'ils emettent — presente
    ou ajoutee plus tard — passe forcement par le regulateur. Il n'y a pas de
    porte de sortie.
    """
    original = urllib.request.urlopen
    regulateur.urlopen_direct = original

    def regule(requete, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        url = requete.full_url if hasattr(requete, "full_url") else str(requete)

        permis, raison = regulateur.verdict(url)
        if not permis:
            raise Interdit(raison or "robots.txt interdit")

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
        """Un enregistrement par clef, le DERNIER ecrit.

        Le journal est un fichier en ajout : relancer la collecte sur la meme
        URL y ajoute une ligne de plus, sans effacer la precedente — c'est
        voulu, on garde l'historique. Mais la consolidation doit rendre un
        resultat par page, et le plus recent : sinon « 12 pages collectees »
        devient « 0 / 36 » apres trois essais, et donnees.json contient trois
        fois chaque produit.
        """
        if not self.chemin.exists():
            return []
        par_clef: dict[str, dict] = {}
        for ligne in self.chemin.read_text(encoding="utf-8").splitlines():
            try:
                objet = json.loads(ligne)
            except json.JSONDecodeError:
                continue
            clef = objet.get("clef")
            if clef:
                par_clef[clef] = objet
        return list(par_clef.values())


# ════════════════════════════ les taches ════════════════════════════


ARRET = threading.Event()


def lis_lignes(chemin: str) -> list[str]:
    return [
        l.strip()
        for l in Path(chemin).read_text(encoding="utf-8").splitlines()
        if l.strip() and not l.strip().startswith("#")
    ]


def moissonne(scrape, url: str, motif: re.Pattern[str]) -> dict:
    """Releve les liens d'une page de liste, sans rien en extraire d'autre.

    Une page de categorie ne decrit aucun produit : l'y faire passer par
    l'extracteur ne rendrait qu'un titre de rubrique. Ce qu'elle contient
    d'utile, ce sont les liens vers les fiches — et la pagination se traite en
    mettant simplement les pages ?page=1..N dans le fichier d'URL.
    """
    page, raison = scrape.recupere(url, essais=2)
    if page is None:
        return {"ok": False, "url": url, "raison": raison or "inconnu", "liens": []}

    base = url
    trouves, vus = [], set()
    for href in re.findall(r'href="([^"]+)"', page):
        complet = urllib.parse.urljoin(base, href.strip())
        if complet in vus or not motif.search(complet):
            continue
        vus.add(complet)
        trouves.append(complet)
    return {"ok": True, "url": url, "liens": trouves}


def une_page(
    scrape,
    url: str,
    dossier_images: Path | None,
    max_images: int,
    navigateur=None,  # noqa: ANN001 — browser.Navigateur
) -> dict:
    """Une page : extraction, puis visuels si demandes.

    Avec un navigateur, le HTML vient du rendu ; sans, de la lecture directe.
    La suite est identique — c'est tout l'interet : `analyse()` ne sait pas
    d'ou vient le HTML qu'on lui donne.
    """
    if navigateur is not None:
        page, info = navigateur.recupere(url)
        raison = info.get("raison")
        rendu = {"rendu": "navigateur", "ms": info.get("ms"), "statut": info.get("statut")}
    else:
        page, raison = scrape.recupere(url, essais=2)
        rendu = {"rendu": "html"}

    if page is None:
        return {"ok": False, "url": url, "raison": raison or "inconnu", **rendu}

    res = scrape.analyse(page, url)
    sortie: dict = {
        "ok": True,
        "url": url,
        **rendu,
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
    quoi.add_argument("--liens", metavar="MOTIF",
                      help="MOISSON : relever dans chaque page les liens correspondant à cette "
                           "expression régulière, au lieu d'en extraire un produit. "
                           r"Exemple pour ManoMano : --liens '/p/[a-z0-9-]+-\d+$'")
    quoi.add_argument("--sortie-liens", default="collect/liens.txt",
                      help="fichier où écrire les liens moissonnés (défaut collect/liens.txt)")
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

    nav = p.add_argument_group("rendu navigateur")
    nav.add_argument("--navigateur", action="store_true",
                     help="rendre les pages dans un vrai navigateur (Playwright). "
                          "Nécessaire quand le contenu n'arrive qu'après le JavaScript.")
    nav.add_argument("--attente", default="reseau", choices=("dom", "reseau"),
                     help="jusqu'où attendre : « dom » plus rapide, « reseau » plus sûr (défaut)")
    nav.add_argument("--selecteur", help="attendre l'apparition de cet élément CSS avant de lire")
    nav.add_argument("--fenetre", action="store_true", help="afficher le navigateur (diagnostic)")

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

    # Le navigateur est ouvert UNE fois, avec le regulateur : Playwright ne
    # passant pas par urllib, c'est `browser.Navigateur` qui le consulte
    # explicitement. Sans cela, le rendu echapperait a la limite de debit.
    navigateur = None
    if args.navigateur:
        browser = importe("browser")
        try:
            navigateur = browser.Navigateur(
                regulateur=regulateur,
                attente=args.attente,
                selecteur=args.selecteur,
                fenetre=args.fenetre,
            )
            navigateur.ouvre()
        except browser.NavigateurIndisponible as erreur:
            print(f"Navigateur indisponible : {erreur}")
            return 1

    print()
    print(f"  débit        {args.rps} req/s par hôte, rafale {args.burst}")
    if navigateur is not None:
        print(f"  rendu        navigateur, attente « {args.attente} »"
              + (f", sélecteur {args.selecteur}" if args.selecteur else ""))
    print(f"  concurrence  {args.concurrence} hôte(s) en parallèle, 1 appel à la fois par hôte")
    print(f"  robots.txt   {'ignoré' if args.ignore_robots else 'respecté'}")
    print(f"  journal      {journal.chemin}" + (f" ({len(journal.deja)} déjà fait)" if journal.deja else ""))
    print()

    # ─── moisson de liens ───
    #
    # Place AVANT la collecte de pages : moissonner puis collecter dans la
    # meme commande n'aurait pas de sens, puisque le fichier d'URL a relire
    # vient d'etre ecrit. Les deux etapes sont donc deux commandes.
    if args.liens:
        if not args.urls:
            print("--liens demande --urls (le fichier des pages de liste à moissonner).")
            return 1
        motif = re.compile(args.liens)
        pages_liste = lis_lignes(args.urls)
        print(f"{len(pages_liste)} page(s) de liste à moissonner, motif « {args.liens} »")

        tous: list[str] = []
        vus: set[str] = set()
        faits = 0
        with ThreadPoolExecutor(max_workers=args.concurrence) as pool:
            taches = {pool.submit(moissonne, scrape, u, motif): u for u in pages_liste}
            for tache in as_completed(taches):
                url = taches[tache]
                if ARRET.is_set():
                    tache.cancel()
                try:
                    res = tache.result()
                except Interdit as refus:
                    res = {"ok": False, "url": url, "raison": str(refus), "liens": []}
                except Exception as erreur:  # noqa: BLE001
                    res = {"ok": False, "url": url, "raison": f"{type(erreur).__name__}", "liens": []}
                journal.ajoute(f"liens:{url}", res)
                nouveaux = 0
                for lien in res.get("liens") or []:
                    if lien not in vus:
                        vus.add(lien)
                        tous.append(lien)
                        nouveaux += 1
                faits += 1
                etat = "✓" if res.get("ok") else "✗"
                print(f"  [{faits}/{len(pages_liste)}] {etat} {url[-56:]:56} "
                      f"+{nouveaux:3} ({len(tous)} au total)")

        cible = Path(args.sortie_liens)
        cible.parent.mkdir(parents=True, exist_ok=True)
        # Les liens deja presents sont conserves : moissonner une deuxieme
        # categorie ne doit pas effacer la premiere.
        anciens = set(lis_lignes(str(cible))) if cible.exists() else set()
        fusion = sorted(anciens | vus)
        cible.write_text("\n".join(fusion) + "\n", encoding="utf-8")

        print()
        print(f"  {len(vus)} lien(s) relevé(s), {len(fusion)} au total dans le fichier")
        print(f"  → {cible}")
        print()
        print("  Étape suivante :")
        print(f"    python3 tools/collect.py --urls {cible} --rps {args.rps}")
        print()
        print("  DÉBIT TENU")
        for ligne in regulateur.rapport():
            print(ligne)
        return 0

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
                pool.submit(une_page, scrape, u, dossier_images, args.max_images, navigateur): u
                for u in a_faire
            }
            for tache in as_completed(taches):
                url = taches[tache]
                if ARRET.is_set():
                    tache.cancel()
                try:
                    res = tache.result()
                except Interdit as refus:
                    res = {"ok": False, "url": url, "raison": str(refus)}
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

    if navigateur is not None:
        navigateur.ferme()

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
