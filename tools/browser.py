#!/usr/bin/env python3
"""
Cote Python du rendu navigateur : pilote tools/render.mjs.

    from browser import Navigateur
    with Navigateur(regulateur=r) as nav:
        html, info = nav.recupere("https://…")

LE POINT QU'IL NE FAUT PAS RATER.

Le regulateur de `collect.py` fonctionne en remplacant
`urllib.request.urlopen`. Playwright ne passe pas par urllib : un rendu
navigateur ECHAPPERAIT donc completement a la limite de debit, et
l'orchestrateur perdrait tout son interet au moment ou l'on en a le plus
besoin.

Cette classe appelle donc `regulateur.attends(url)` explicitement avant chaque
navigation, et `regulateur.punit()` quand la page revient en 429 ou 503. La
limite s'applique de la meme facon, que la page soit lue par urllib ou rendue
par un navigateur.

CE QU'IL FAUT INSTALLER, une fois :

    npm install playwright
    npx playwright install chromium

Si un Chromium est deja present ailleurs, `RENDER_CHROMIUM` evite de le
retelecharger.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path

ICI = Path(__file__).resolve().parent
RENDER = ICI / "render.mjs"


class NavigateurIndisponible(RuntimeError):
    """Node ou Playwright manque : le message dit quoi installer."""


class Navigateur:
    """Un navigateur ouvert une fois, interroge ligne par ligne."""

    def __init__(
        self,
        regulateur=None,  # noqa: ANN001 — collect.Regulateur, importe a l'envers
        attente: str = "reseau",
        delai_ms: int = 25000,
        selecteur: str | None = None,
        avec_images: bool = False,
        fenetre: bool = False,
        node: str = "node",
    ) -> None:
        self.regulateur = regulateur
        self.attente = attente
        self.delai_ms = delai_ms
        self.selecteur = selecteur
        self.avec_images = avec_images
        self.fenetre = fenetre
        self.node = node
        self._proc: subprocess.Popen[str] | None = None
        self._id = 0
        # Un seul navigateur, donc un seul dialogue a la fois : le verrou
        # serialise les appels venant des fils d'execution de l'orchestrateur.
        self._verrou = threading.Lock()

    # ───────────────────────────── cycle de vie ─────────────────────────────

    def __enter__(self) -> Navigateur:
        self.ouvre()
        return self

    def __exit__(self, *_: object) -> None:
        self.ferme()

    def ouvre(self) -> None:
        if not RENDER.exists():
            raise NavigateurIndisponible(f"{RENDER} est introuvable")

        commande = [self.node, str(RENDER)]
        if self.fenetre:
            commande.append("--fenetre")
        if self.avec_images:
            commande.append("--avec-images")

        try:
            self._proc = subprocess.Popen(  # noqa: S603
                commande,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                # UTF-8 EXPLICITE, et ce n'est pas un detail de confort.
                #
                # Sans cette ligne, Python decode la sortie de l'enfant avec
                # l'encodage de la machine : cp1252 sous Windows. Le JSON qui
                # transporte le HTML est en UTF-8, et la premiere page
                # contenant un caractere accentue leve UnicodeDecodeError —
                # « charmap codec can't decode byte 0x8d ». La page est perdue
                # pour une raison qui n'a rien a voir avec le site.
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                cwd=str(ICI.parent),
                env={**os.environ},
            )
        except FileNotFoundError as erreur:
            raise NavigateurIndisponible(
                "Node est introuvable. Installez Node.js, puis :\n"
                "  npm install playwright\n"
                "  npx playwright install chromium"
            ) from erreur

        # Les traces du navigateur sont relayees sur notre stderr, dans un fil
        # a part : sans cela, un tampon plein bloquerait le processus enfant.
        threading.Thread(target=self._relaie_traces, daemon=True).start()

        # On attend le signal de disponibilite avant d'envoyer quoi que ce soit.
        premiere = self._proc.stdout.readline() if self._proc.stdout else ""
        if not premiere.strip():
            erreurs = self._proc.stderr.read() if self._proc.stderr else ""
            self.ferme()
            raise NavigateurIndisponible(
                "le navigateur ne s'est pas ouvert.\n"
                "  npm install playwright && npx playwright install chromium\n"
                + (f"  détail : {erreurs.strip()[:400]}" if erreurs.strip() else "")
            )
        try:
            if not json.loads(premiere).get("pret"):
                raise ValueError
        except (json.JSONDecodeError, ValueError) as erreur:
            self.ferme()
            raise NavigateurIndisponible(f"réponse inattendue à l'ouverture : {premiere[:200]}") from erreur

    def _relaie_traces(self) -> None:
        proc = self._proc
        if not proc or not proc.stderr:
            return
        for ligne in proc.stderr:
            texte = ligne.rstrip()
            if texte:
                print(f"    {texte}", file=sys.stderr)

    def ferme(self) -> None:
        proc, self._proc = self._proc, None
        if not proc:
            return
        # L'enfant peut deja etre mort — c'est le cas normal quand on ferme
        # apres un echec d'ouverture. Ecrire dans son entree leve alors
        # BrokenPipeError, et cette exception masquerait la vraie raison de
        # l'echec. On la laisse donc passer sans bruit.
        try:
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.write(json.dumps({"fin": True}) + "\n")
                proc.stdin.flush()
        except (BrokenPipeError, OSError, ValueError):
            pass
        try:
            proc.wait(timeout=10)
        except Exception:  # noqa: BLE001
            proc.kill()

    # ─────────────────────────────── le rendu ───────────────────────────────

    def recupere(self, url: str) -> tuple[str | None, dict]:
        """(html, informations). `html` vaut None en cas d'echec."""
        if not self._proc:
            raise NavigateurIndisponible("navigateur non ouvert")

        # LA limite de debit. Playwright ne passe pas par urllib, donc la
        # greffe de collect.py ne le voit pas : c'est ici, et seulement ici,
        # que le rendu entre dans le budget de l'hote.
        hote = None
        if self.regulateur is not None:
            permis, raison = (
                self.regulateur.verdict(url)
                if hasattr(self.regulateur, "verdict")
                else (self.regulateur.autorise(url), None)
            )
            if not permis:
                return None, {"ok": False, "url": url, "raison": raison or "robots.txt interdit"}
            hote = self.regulateur.attends(url)

        with self._verrou:
            self._id += 1
            demande = {
                "id": self._id,
                "url": url,
                "attente": self.attente,
                "delai": self.delai_ms,
                "selecteur": self.selecteur,
            }
            assert self._proc.stdin and self._proc.stdout
            self._proc.stdin.write(json.dumps(demande) + "\n")
            self._proc.stdin.flush()
            ligne = self._proc.stdout.readline()

        if not ligne.strip():
            return None, {"ok": False, "url": url, "raison": "le navigateur s'est arrêté"}
        try:
            res = json.loads(ligne)
        except json.JSONDecodeError:
            return None, {"ok": False, "url": url, "raison": f"réponse illisible : {ligne[:160]}"}

        if hote is not None and self.regulateur is not None:
            if res.get("statut") in (429, 503):
                self.regulateur.punit(hote, None)
            elif res.get("ok"):
                self.regulateur.pardonne(hote)
            # Le seau ne regule que la navigation. Ce que la page demande
            # ensuite d'elle-meme est compte a part, pour que le rapport dise
            # le trafic reel et non la moitie.
            noter = getattr(self.regulateur, "note_sous_requetes", None)
            if noter and isinstance(res.get("requetes"), int):
                noter(hote, res["requetes"])

        html = res.pop("html", None)
        if res.get("ok") and res.get("statut", 200) >= 400:
            res["ok"] = False
            res.setdefault("raison", f"HTTP {res['statut']}")
        return (html if res.get("ok") else None), res


def essai(url: str) -> int:
    """Un rendu, affiche ce qu'on en tire. Sert a verifier l'installation."""
    sys.path.insert(0, str(ICI))
    import importlib.util

    spec = importlib.util.spec_from_file_location("scrape", ICI / "scrape.py")
    assert spec and spec.loader
    scrape = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scrape)

    try:
        with Navigateur() as nav:
            html, info = nav.recupere(url)
    except NavigateurIndisponible as erreur:
        print(f"✗ {erreur}")
        return 1

    if html is None:
        print(f"✗ {info.get('raison')}")
        return 1

    res = scrape.analyse(html, url)
    print()
    print(f"  statut   {info.get('statut')}  en {info.get('ms')} ms, {info.get('octets')} octets")
    print(f"  cookies  {info.get('consentement') or 'aucune bannière'}")
    print(f"  titre    {(res.get('titre') or '—')[:72]}")
    prix = f"{res['prix']:.2f} {res.get('devise') or ''}".strip() if res.get("prix") else "—"
    print(f"  prix     {prix}   ({res['methodes'].get('prix', 'introuvable')})")
    print(f"  desc     {len(res.get('description') or '')} car.   ({res['methodes'].get('description', 'introuvable')})")
    print(f"  images   {len(res['images'])}   ({res['methodes'].get('images', 'introuvable')})")
    return 0 if res.get("complet") else 2


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        print("Usage : python3 tools/browser.py <url>")
        raise SystemExit(1)
    raise SystemExit(essai(sys.argv[1]))
