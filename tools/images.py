#!/usr/bin/env python3
"""
Recherche d'images par mot-cle, sur plusieurs moteurs, et telechargement.

    python3 tools/images.py "chimenea electrica HOMCOM 1800W" -n 20
    python3 tools/images.py --depuis-json scraped/produits.json --cle titre
    python3 tools/images.py "KEKAI Oregon" --moteur bing --min 800
    python3 tools/images.py "..." --dossier mes-images --json

QUATRE MOTEURS, ESSAYES DANS CET ORDRE.

Aucun moteur d'images n'expose d'API publique stable, et chacun casse a son
rythme. Le script en empile donc quatre, du plus fiable au plus fragile, passe
au suivant quand l'un ne rend rien, et DIT lequel a repondu :

  commons   API Wikimedia Commons. Une vraie API JSON, documentee, sans clef
            ni quota agressif. Peu de produits, mais quand il y en a, ca
            marche toujours. En premier parce que c'est le seul qui ne soit
            pas du scraping.
  ddg       DuckDuckGo. Demande d'abord un jeton `vqd` sur la page de
            recherche, puis interroge un point d'entree JSON. Deux requetes,
            mais une reponse structuree et propre.
  bing      Bing Images. Rend du HTML ou chaque vignette porte un attribut
            `m="{...}"` contenant du JSON avec l'URL de l'image d'origine
            (`murl`). Tres stable depuis des annees.
  google    Google Images. Le plus fourni et le plus hostile : le HTML ne
            contient plus que des miniatures encodees en base64, les vraies
            URL vivant dans des blocs de script. Le script tente trois
            formes connues. S'il ne rend rien, c'est normal : il faut un
            navigateur.

CE QUI EST FAIT AU TELECHARGEMENT

  — la taille reelle est lue dans l'en-tete du fichier (JPEG, PNG, WebP, GIF)
    et `--min` ecarte ce qui est trop petit : une recherche d'images rend
    beaucoup de vignettes ;
  — les doublons sont detectes par empreinte du CONTENU, pas par URL : le
    meme visuel est souvent servi depuis cinq domaines differents ;
  — les fichiers qui ne sont pas des images (page d'erreur HTML renvoyee en
    200) sont reconnus par leurs octets d'en-tete et jetes.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

ENTETES = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,es;q=0.7",
    "Accept-Encoding": "gzip, deflate",
}

SIGNATURES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF", b"GIF8")


# ════════════════════════════════ reseau ════════════════════════════════


def charge(url: str, referer: str | None = None, essais: int = 2) -> bytes | None:
    entetes = dict(ENTETES)
    if referer:
        entetes["Referer"] = referer
    for essai in range(essais):
        try:
            requete = urllib.request.Request(url, headers=entetes)
            with urllib.request.urlopen(requete, timeout=25) as reponse:
                corps = reponse.read()
                codage = (reponse.headers.get("Content-Encoding") or "").lower()
                if codage == "gzip":
                    corps = gzip.decompress(corps)
                elif codage == "deflate":
                    corps = zlib.decompress(corps, -zlib.MAX_WBITS)
                return corps
        except Exception:  # noqa: BLE001
            if essai == essais - 1:
                return None
            time.sleep(1.5 * (essai + 1))
    return None


def texte(url: str, referer: str | None = None) -> str | None:
    corps = charge(url, referer)
    return corps.decode("utf-8", errors="replace") if corps else None


# ═══════════════════════════ dimensions ═══════════════════════════


def dimensions(buf: bytes) -> tuple[int, int] | None:
    """Taille lue dans l'en-tete. Ecrite a la main : quatre formats, zero dependance."""
    if len(buf) > 24 and buf[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(buf[16:20], "big"), int.from_bytes(buf[20:24], "big")

    if len(buf) > 10 and buf[:4] == b"GIF8":
        return int.from_bytes(buf[6:8], "little"), int.from_bytes(buf[8:10], "little")

    # `>= 30` et non `> 30` : l'en-tete VP8X fait EXACTEMENT 30 octets
    # (RIFF 12, VP8X 8, drapeaux 4, largeur 3, hauteur 3). Un fichier reel est
    # toujours plus long, mais la borne etait fausse — un test l'a montre.
    if len(buf) >= 30 and buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        genre = buf[12:16]
        if genre == b"VP8X":
            lire = lambda o: buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16)  # noqa: E731
            return lire(24) + 1, lire(27) + 1
        if genre == b"VP8 ":
            return (
                int.from_bytes(buf[26:28], "little") & 0x3FFF,
                int.from_bytes(buf[28:30], "little") & 0x3FFF,
            )
        if genre == b"VP8L":
            bits = int.from_bytes(buf[21:25], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1

    if len(buf) > 4 and buf[0] == 0xFF and buf[1] == 0xD8:
        i = 2
        while i + 9 < len(buf):
            if buf[i] != 0xFF:
                i += 1
                continue
            marqueur = buf[i + 1]
            if 0xC0 <= marqueur <= 0xCF and marqueur not in (0xC4, 0xC8, 0xCC):
                return (
                    int.from_bytes(buf[i + 7 : i + 9], "big"),
                    int.from_bytes(buf[i + 5 : i + 7], "big"),
                )
            longueur = int.from_bytes(buf[i + 2 : i + 4], "big")
            if longueur < 2:
                return None
            i += 2 + longueur
    return None


# ════════════════════════════ les moteurs ════════════════════════════


def commons(requete: str, combien: int) -> list[str]:
    """API Wikimedia Commons. Le seul moteur qui ne soit pas du scraping."""
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": f"filetype:bitmap {requete}",
            "gsrlimit": str(min(combien * 2, 50)),
            "gsrnamespace": "6",
            "prop": "imageinfo",
            "iiprop": "url|size",
            "iiurlwidth": "1600",
        }
    )
    brut = texte(url)
    if not brut:
        return []
    try:
        data = json.loads(brut)
    except json.JSONDecodeError:
        return []
    pages = ((data.get("query") or {}).get("pages") or {}).values()
    sortie = []
    for page in pages:
        for info in page.get("imageinfo") or []:
            lien = info.get("url") or info.get("thumburl")
            if lien:
                sortie.append(lien)
    return sortie


def duckduckgo(requete: str, combien: int) -> list[str]:
    """DuckDuckGo : un jeton `vqd` a recuperer, puis un point d'entree JSON."""
    accueil = texte(
        "https://duckduckgo.com/?" + urllib.parse.urlencode({"q": requete, "iax": "images", "ia": "images"})
    )
    if not accueil:
        return []
    jeton = None
    for motif in (r'vqd=["\']([\d-]+)["\']', r"vqd=([\d-]+)&", r'"vqd":"([^"]+)"'):
        trouve = re.search(motif, accueil)
        if trouve:
            jeton = trouve.group(1)
            break
    if not jeton:
        return []

    url = "https://duckduckgo.com/i.js?" + urllib.parse.urlencode(
        {"l": "fr-fr", "o": "json", "q": requete, "vqd": jeton, "f": ",,,", "p": "1"}
    )
    brut = texte(url, referer="https://duckduckgo.com/")
    if not brut:
        return []
    try:
        data = json.loads(brut)
    except json.JSONDecodeError:
        return []
    return [r["image"] for r in data.get("results", []) if r.get("image")][: combien * 3]


def bing(requete: str, combien: int) -> list[str]:
    """Bing : chaque vignette porte un attribut m="{...}" avec l'URL d'origine."""
    sortie: list[str] = []
    for depart in range(1, combien * 3, 35):
        url = "https://www.bing.com/images/async?" + urllib.parse.urlencode(
            {"q": requete, "first": str(depart), "count": "35", "mkt": "fr-FR", "adlt": "moderate"}
        )
        page = texte(url, referer="https://www.bing.com/images")
        if not page:
            break
        # L'attribut est du JSON echappe en HTML : &quot; au lieu de ".
        for trouve in re.finditer(r'm="(\{[^"]*?\})"', page):
            try:
                bloc = json.loads(trouve.group(1).replace("&quot;", '"'))
            except json.JSONDecodeError:
                continue
            if bloc.get("murl"):
                sortie.append(bloc["murl"])
        if len(sortie) >= combien * 2:
            break
        time.sleep(1.0)
    return sortie


def google(requete: str, combien: int) -> list[str]:
    """Google Images : le plus fourni, le plus hostile. Trois formes tentees."""
    url = "https://www.google.com/search?" + urllib.parse.urlencode(
        {"q": requete, "tbm": "isch", "hl": "fr", "gl": "fr", "num": str(min(combien * 3, 100))}
    )
    page = texte(url, referer="https://www.google.com/")
    if not page:
        return []

    sortie: list[str] = []
    # a) l'ancienne forme, encore servie a certains agents : "ou":"<url>".
    sortie += re.findall(r'"ou":"(https?://[^"]+?)"', page)
    # b) la forme actuelle : des triplets ["url", hauteur, largeur].
    sortie += [
        u.encode().decode("unicode_escape")
        for u in re.findall(r'\["(https?://[^"]+?\.(?:jpe?g|png|webp))",\d+,\d+\]', page)
    ]
    # c) a defaut, toute URL d'image hors domaines de service Google.
    if not sortie:
        sortie += [
            u
            for u in re.findall(r'(https?://[^"\\\s]+?\.(?:jpe?g|png|webp))', page)
            if "gstatic" not in u and "google" not in u
        ]
    return sortie[: combien * 3]


MOTEURS = {"commons": commons, "ddg": duckduckgo, "bing": bing, "google": google}
ORDRE = ("commons", "ddg", "bing", "google")


# ════════════════════════════ telechargement ════════════════════════════


def recupere_images(
    urls: list[str], dossier: Path, combien: int, mini: int, delai: float
) -> list[dict]:
    """Telecharge, mesure, ecarte les doublons de CONTENU et les vignettes."""
    dossier.mkdir(parents=True, exist_ok=True)
    empreintes: set[str] = set()
    gardees: list[dict] = []
    position = 0

    for url in urls:
        if len(gardees) >= combien:
            break
        corps = charge(url)
        if not corps or len(corps) < 2048:
            continue
        if not corps.startswith(SIGNATURES):
            continue  # page d'erreur servie en 200, par exemple

        taille = dimensions(corps)
        if taille is None:
            continue
        largeur, hauteur = taille
        if min(largeur, hauteur) < mini:
            continue

        empreinte = hashlib.sha256(corps).hexdigest()
        if empreinte in empreintes:
            continue
        empreintes.add(empreinte)

        position += 1
        suffixe = {b"\xff\xd8\xff": ".jpg", b"\x89PNG\r\n\x1a\n": ".png", b"RIFF": ".webp", b"GIF8": ".gif"}
        extension = next((v for k, v in suffixe.items() if corps.startswith(k)), ".jpg")
        cible = dossier / f"{position:02d}{extension}"
        cible.write_bytes(corps)

        gardees.append(
            {
                "fichier": str(cible),
                "source": url,
                "largeur": largeur,
                "hauteur": hauteur,
                "octets": len(corps),
            }
        )
        print(f"      {position:02d}. {largeur}×{hauteur}  {len(corps) // 1024} Ko")
        time.sleep(delai * 0.5)

    return gardees


# ════════════════════════════ principal ════════════════════════════


def cherche(requete: str, moteur: str, combien: int) -> tuple[str, list[str]]:
    """(moteur qui a repondu, URL trouvees). Essaie les suivants si besoin."""
    candidats = [moteur] if moteur != "auto" else list(ORDRE)
    for nom in candidats:
        urls = MOTEURS[nom](requete, combien)
        # Dedoublonnage par URL, en gardant l'ordre du moteur.
        vues, propres = set(), []
        for u in urls:
            if u not in vues and u.startswith("http"):
                vues.add(u)
                propres.append(u)
        print(f"    {nom:8} {len(propres)} URL")
        if propres:
            return nom, propres
    return "aucun", []


def nom_dossier(requete: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", requete).strip("-").lower()[:80] or "recherche"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("requete", nargs="*", help="les mots-clés à chercher")
    p.add_argument("--depuis-json", help="fichier JSON produit par scrape.py")
    p.add_argument("--cle", default="titre", help="clé à utiliser comme requête (défaut « titre »)")
    p.add_argument("-n", "--combien", type=int, default=10, help="images à garder par requête (défaut 10)")
    p.add_argument("--min", type=int, default=600, dest="mini", help="côté minimal en pixels (défaut 600)")
    p.add_argument("--moteur", default="auto", choices=("auto", *ORDRE), help="moteur (défaut auto)")
    p.add_argument("--dossier", default="scraped/recherche", help="dossier de sortie")
    p.add_argument("--delai", type=float, default=1.5, help="secondes entre deux requêtes")
    p.add_argument("--sans-telechargement", action="store_true", help="lister les URL sans rien écrire")
    p.add_argument("--json", action="store_true", help="JSON sur la sortie standard")
    args = p.parse_args()

    requetes: list[str] = [" ".join(args.requete)] if args.requete else []
    if args.depuis_json:
        data = json.loads(Path(args.depuis_json).read_text(encoding="utf-8"))
        lignes = data if isinstance(data, list) else data.get("fiches", [])
        for ligne in lignes:
            valeur = (ligne or {}).get(args.cle)
            if isinstance(valeur, str) and valeur.strip():
                requetes.append(valeur.strip())

    requetes = [r for r in requetes if r]
    if not requetes:
        p.print_help()
        return 1

    racine = Path(args.dossier)
    resultats: list[dict] = []

    for position, requete in enumerate(requetes, start=1):
        if not args.json:
            print(f"\n[{position}/{len(requetes)}] « {requete[:76]} »")
        moteur, urls = cherche(requete, args.moteur, args.combien)
        entree: dict = {"requete": requete, "moteur": moteur, "urlsTrouvees": len(urls)}

        if not urls:
            entree["images"] = []
            resultats.append(entree)
            if not args.json:
                print("    ✗ aucun moteur n'a répondu")
            continue

        if args.sans_telechargement:
            entree["urls"] = urls[: args.combien]
        else:
            entree["images"] = recupere_images(
                urls, racine / nom_dossier(requete), args.combien, args.mini, args.delai
            )
            if not args.json:
                retenues = len(entree["images"])
                print(f"    {retenues} image(s) retenue(s) sur {len(urls)} URL (≥ {args.mini} px)")

        resultats.append(entree)
        time.sleep(args.delai)

    racine.mkdir(parents=True, exist_ok=True)
    manifeste = racine / "images.json"
    manifeste.write_text(json.dumps(resultats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(resultats, ensure_ascii=False, indent=2))
        return 0

    total = sum(len(r.get("images") or r.get("urls") or []) for r in resultats)
    muets = [r["requete"] for r in resultats if not (r.get("images") or r.get("urls"))]
    print()
    print(f"{total} image(s) pour {len(requetes)} recherche(s).")
    print(f"→ {manifeste}")
    if muets:
        print()
        print(f"{len(muets)} recherche(s) sans résultat :")
        for r in muets[:8]:
            print(f"  ✗ {r[:72]}")
        print()
        print("Si c'est Google qui ne rend rien, c'est attendu : son HTML ne porte")
        print("plus que des miniatures en base64. Essayez --moteur bing ou ddg.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
