#!/usr/bin/env python3
"""
Extrait photos, description et prix des fiches produit ManoMano.

    python3 scripts/scrape_manomano.py --releve          # les URL deja relevees
    python3 scripts/scrape_manomano.py --categorie https://www.manomano.es/chimeneas-de-bioetanol-3096 --pages 9
    python3 scripts/scrape_manomano.py --html-dir pages/ # fichiers HTML enregistres a la main

CE QU'IL EXTRAIT, ET POURQUOI C'EST FIABLE.

Le script ne lit NI le HTML visible, NI des classes CSS. Il lit le bloc
`<script id="__NEXT_DATA__">` que le site depose dans chaque page : c'est
l'etat que l'application React consomme elle-meme. Un changement de maquette
ne le casse donc pas, et il contient des champs que la page n'affiche meme
pas.

Le chemin exact a ete releve sur une vraie fiche :

    props.pageProps.initialReduxState
        .productDiscovery.productPage.detail

et il porte :

    title              le titre reel du vendeur
    description        la description, en HTML
    media[]            regularUrl (moyenne) et largeUrl (grande)
    price              primaryPrice.amountWithVat / amountWithoutVat,
                       retailPrice (prix barre), discountPercentage
    delivery.weight    le POIDS, en kg - celui qui commande le prix du port
    ean                le code-barres, qui identifie le produit chez
                       n'importe quel autre fournisseur
    manufacturerSKU    la reference du fabricant
    attributes[]       les caracteristiques structurees (Alto, Ancho,
                       Potencia, Material, Color...), avec leur unite
    pdfs               notice, document de securite, fiche fabricant
    seller             le vendeur et son pays

L'EAN et la reference fabricant valent a eux seuls le detour : avec eux, on
retrouve le meme article chez un grossiste qui, lui, vend en gros et fournit
des visuels utilisables.

DROITS D'AUTEUR, dit une fois et clairement. Les photos et les descriptions
appartiennent aux vendeurs de la place de marche. Les recuperer pour
travailler - comparer, retrouver un article chez un grossiste, verifier une
caracteristique - est une chose. Les republier sur une boutique en est une
autre, et celle-la demande l'accord ecrit du titulaire des droits.

Le script est volontairement lent et sans dependance : urllib de la
bibliotheque standard, un delai entre deux requetes, et une reprise qui saute
ce qui est deja fait. Il n'y a rien a installer.
"""

from __future__ import annotations

import argparse
import gzip
import html
import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://www.manomano.es"

RELEVES = Path("data/releves")
SORTIE = RELEVES / "manomano-fiches.json"
MEDIA = RELEVES / "media"
DEBUG = RELEVES / "_debug"

# Un navigateur ordinaire. Sans en-tetes credibles, beaucoup de sites
# repondent 403 — ce n'est pas du camouflage, c'est le minimum pour etre servi.
ENTETES = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,fr;q=0.8,en;q=0.7",
    # gzip seulement : brotli demanderait une dependance pour le decompresser,
    # et un corps brotli non decodable est un echec silencieux.
    "Accept-Encoding": "gzip",
    "Connection": "close",
}

BLOC = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
    re.S,
)


# ───────────────────────────────── reseau ─────────────────────────────────


def recupere(url: str, essais: int = 4, delai: float = 1.5) -> bytes | None:
    """Une requete, avec reprise exponentielle sur les erreurs passageres."""
    for essai in range(essais):
        try:
            requete = urllib.request.Request(url, headers=ENTETES)
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                corps = reponse.read()
                if reponse.headers.get("Content-Encoding") == "gzip":
                    corps = gzip.decompress(corps)
                return corps
        except urllib.error.HTTPError as erreur:
            # 404 : la page n'existe pas, reessayer est inutile.
            if erreur.code == 404:
                print(f"    404 {url}")
                return None
            # 403 / 429 : on est freine ou bloque. Attendre plus longtemps.
            attente = delai * (2 ** essai) + random.uniform(0, 1)
            print(f"    HTTP {erreur.code}, nouvelle tentative dans {attente:.0f} s")
            time.sleep(attente)
        except Exception as erreur:  # noqa: BLE001 — reseau : tout peut arriver
            attente = delai * (2 ** essai) + random.uniform(0, 1)
            print(f"    {type(erreur).__name__}, nouvelle tentative dans {attente:.0f} s")
            time.sleep(attente)
    print(f"    ABANDON {url}")
    return None


# ──────────────────────────────── extraction ────────────────────────────────


def etat_next(page: str) -> dict | None:
    """Le bloc __NEXT_DATA__ d'une page, decode."""
    trouve = BLOC.search(page)
    if not trouve:
        return None
    try:
        return json.loads(trouve.group(1))
    except json.JSONDecodeError:
        return None


def texte_simple(code_html: str) -> str:
    """Description en texte lisible, en gardant les coupures de paragraphe."""
    t = re.sub(r"<\s*br\s*/?>", "\n", code_html, flags=re.I)
    t = re.sub(r"</\s*(p|li|div|h\d)\s*>", "\n", t, flags=re.I)
    t = re.sub(r"<\s*li[^>]*>", "— ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\xa0", " ")
    lignes = [ligne.strip() for ligne in t.split("\n")]
    return "\n".join(ligne for ligne in lignes if ligne)


def nombre_propre(valeur: object) -> object:
    """« 4200.0 » se lit « 4200 ». Le site stocke tout en flottant."""
    if isinstance(valeur, str) and re.fullmatch(r"-?\d+\.0+", valeur):
        return valeur.split(".")[0]
    return valeur


def attribut(detail: dict, *noms: str) -> str | None:
    """Valeur d'un attribut structure, unite comprise.

    Les attributs sont une liste et non un dictionnaire, et leurs noms sont en
    espagnol (« Alto », « Potencia »). On en accepte donc plusieurs, et on
    compare sans accents ni casse.
    """
    def plat(s: str) -> str:
        return "".join(
            c for c in unicodedata.normalize("NFD", s.lower())
            if unicodedata.category(c) != "Mn"
        )

    cherches = {plat(n) for n in noms}
    for attr in detail.get("attributes") or []:
        nom = attr.get("name") or ""
        if plat(nom) not in cherches:
            continue
        valeurs = attr.get("values") or []
        if valeurs:
            brute = valeurs[0].get("value")
            if brute is None:
                continue
            unite = (attr.get("unit") or {}).get("abbreviation") or ""
            return f"{nombre_propre(brute)} {unite}".strip()
        if attr.get("label"):
            return str(attr["label"])
    return None


def fiche(etat: dict, url: str) -> dict | None:
    """Traduit l'etat de la page en un enregistrement exploitable."""
    try:
        page = (
            etat["props"]["pageProps"]["initialReduxState"]
            ["productDiscovery"]["productPage"]
        )
    except (KeyError, TypeError):
        return None

    detail = page.get("detail") or {}
    if not detail.get("title"):
        return None

    prix = detail.get("price") or {}
    principal = prix.get("primaryPrice") or {}
    conseille = prix.get("retailPrice") or {}
    description = detail.get("description") or ""

    return {
        "url": url,
        "titre": detail.get("title"),
        "marque": (page.get("brand") or {}).get("name"),
        "vendeur": (detail.get("seller") or {}).get("name"),
        "paysVendeur": (detail.get("seller") or {}).get("country"),
        "prixTTC": principal.get("amountWithVat"),
        "prixHT": principal.get("amountWithoutVat"),
        "prixConseilleTTC": conseille.get("amountWithVat"),
        "remisePourcent": prix.get("discountPercentage"),
        "devise": detail.get("currency"),
        "ean": detail.get("ean") or None,
        "referenceFabricant": detail.get("manufacturerSKU") or None,
        "referenceManoMano": detail.get("productRef") or None,
        "poidsKg": (detail.get("delivery") or {}).get("weight"),
        "descriptionHtml": description or None,
        "description": texte_simple(description) or None,
        "caracteristiques": {
            "hauteur": attribut(detail, "Alto", "Altura"),
            "largeur": attribut(detail, "Ancho", "Anchura"),
            "profondeur": attribut(detail, "Profundidad", "Fondo"),
            "puissance": attribut(detail, "Potencia"),
            "matiere": attribut(detail, "Material"),
            "couleur": attribut(detail, "Color"),
            "origine": attribut(detail, "Origen"),
            "capacite": attribut(detail, "Capacidad"),
        },
        # Toutes les caracteristiques, brutes : le dictionnaire ci-dessus ne
        # retient que celles qu'on sait utiliser, et on ne veut pas perdre les
        # autres pour autant.
        "attributsBruts": [
            {
                "nom": a.get("name"),
                "valeur": nombre_propre((a.get("values") or [{}])[0].get("value") or a.get("label")),
                "unite": (a.get("unit") or {}).get("abbreviation"),
            }
            for a in (detail.get("attributes") or [])
        ],
        "images": [
            m.get("largeUrl") or m.get("regularUrl")
            for m in (detail.get("media") or [])
            if m.get("largeUrl") or m.get("regularUrl")
        ],
        "pdfs": {k: v for k, v in (detail.get("pdfs") or {}).items() if v},
        "disponible": detail.get("isSellable"),
    }


# ──────────────────────────────── images ────────────────────────────────


def telecharge_images(ref: str, urls: list[str], dossier: Path, delai: float) -> int:
    """Enregistre les visuels sous 01.jpg, 02.jpg… Saute ceux deja presents."""
    dossier.mkdir(parents=True, exist_ok=True)
    pris = 0
    for position, url in enumerate(urls, start=1):
        suffixe = Path(url.split("?")[0]).suffix or ".jpg"
        cible = dossier / f"{position:02d}{suffixe}"
        if cible.exists() and cible.stat().st_size > 0:
            pris += 1
            continue
        corps = recupere(url)
        if not corps:
            continue
        cible.write_bytes(corps)
        pris += 1
        time.sleep(delai * random.uniform(0.5, 1.0))
    return pris


# ──────────────────────────── collecte des URL ────────────────────────────


def urls_du_releve() -> list[tuple[str, str | None]]:
    """(url, identifiant catalogue) depuis data/releves/*.json."""
    out: list[tuple[str, str | None]] = []
    vus = set()
    if not RELEVES.is_dir():
        return out
    for fichier in sorted(RELEVES.glob("*.json")):
        if fichier.name == SORTIE.name:
            continue
        try:
            data = json.loads(fichier.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if not isinstance(data, dict):
            continue
        for cle, valeur in data.items():
            if cle.startswith("_") or not isinstance(valeur, list):
                continue
            for item in valeur:
                if not isinstance(item, dict):
                    continue
                url = item.get("url")
                if isinstance(url, str) and url not in vus:
                    vus.add(url)
                    out.append((url, item.get("retenu_catalogue")))
    return out


def urls_de_categorie(url_categorie: str, pages: int, delai: float) -> list[tuple[str, None]]:
    """Parcourt les pages d'une categorie et releve les chemins produit.

    La pagination du site se fait par `?page=N`. Une page qui ne rend aucun
    nouveau produit arrete la boucle : c'est la fin reelle, qui ne coincide pas
    toujours avec le nombre annonce.
    """
    trouves: list[tuple[str, None]] = []
    vus: set[str] = set()
    for page in range(1, pages + 1):
        cible = url_categorie if page == 1 else f"{url_categorie}?page={page}"
        print(f"  page {page}/{pages} : {cible}")
        corps = recupere(cible)
        if not corps:
            break
        texte = corps.decode("utf-8", errors="replace")
        chemins = re.findall(r'href="(/p/[a-z0-9\-]+-\d+)"', texte)
        nouveaux = 0
        for chemin in chemins:
            complet = BASE + chemin
            if complet not in vus:
                vus.add(complet)
                trouves.append((complet, None))
                nouveaux += 1
        print(f"    {nouveaux} nouveau(x) produit(s), {len(trouves)} au total")
        if nouveaux == 0:
            print("    plus rien de nouveau : fin de la categorie")
            break
        time.sleep(delai * random.uniform(0.8, 1.4))
    return trouves


def pages_locales(dossier: Path) -> list[tuple[str, str]]:
    """(chemin, contenu) des fichiers HTML enregistres a la main."""
    fichiers = sorted(p for p in dossier.rglob("*") if p.suffix.lower() in {".html", ".htm", ".txt"})
    return [(str(p), p.read_text(encoding="utf-8", errors="replace")) for p in fichiers]


# ───────────────────────────────── principal ─────────────────────────────────


def charge_deja_fait() -> dict[str, dict]:
    if not SORTIE.exists():
        return {}
    try:
        data = json.loads(SORTIE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {f["url"]: f for f in data.get("fiches", []) if isinstance(f, dict) and f.get("url")}


def enregistre(fiches: dict[str, dict]) -> None:
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps(
            {
                "_source": {
                    "nature": "Fiches produit relevées sur ManoMano Espagne.",
                    "extrait_de": "bloc __NEXT_DATA__ des pages produit",
                    "avertissement": (
                        "Photos et descriptions appartiennent aux vendeurs de la "
                        "place de marché. Les republier sur une boutique demande "
                        "l'accord écrit du titulaire des droits. L'EAN et la "
                        "référence fabricant servent, eux, à retrouver le même "
                        "article chez un grossiste."
                    ),
                    "nombre": len(fiches),
                },
                "fiches": sorted(fiches.values(), key=lambda f: f["url"]),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parseur = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    source = parseur.add_mutually_exclusive_group(required=True)
    source.add_argument("--releve", action="store_true", help="les URL déjà présentes dans data/releves/*.json")
    source.add_argument("--categorie", metavar="URL", help="parcourir une page de catégorie")
    source.add_argument("--url", nargs="+", metavar="URL", help="une ou plusieurs fiches précises")
    source.add_argument("--html-dir", metavar="DOSSIER", help="analyser des pages HTML enregistrées à la main")
    parseur.add_argument("--pages", type=int, default=1, help="nombre de pages de catégorie (défaut 1)")
    parseur.add_argument("--delai", type=float, default=1.5, help="secondes entre deux requêtes (défaut 1,5)")
    parseur.add_argument("--limite", type=int, default=0, help="s'arrêter après N fiches (0 = pas de limite)")
    parseur.add_argument("--sans-images", action="store_true", help="ne pas télécharger les visuels")
    parseur.add_argument("--rejouer", action="store_true", help="refaire les fiches déjà relevées")
    args = parseur.parse_args()

    print()
    print("  Photos et descriptions appartiennent aux vendeurs de la place de")
    print("  marché. Les récupérer pour travailler est une chose ; les publier")
    print("  sur la boutique demande l'accord écrit du titulaire des droits.")
    print()

    fiches = {} if args.rejouer else charge_deja_fait()
    if fiches:
        print(f"{len(fiches)} fiche(s) déjà relevée(s), elles seront sautées (--rejouer pour refaire).")

    # ─── pages locales : aucun reseau ───
    if args.html_dir:
        dossier = Path(args.html_dir)
        if not dossier.is_dir():
            print(f"Dossier introuvable : {dossier}")
            return 1
        pages = pages_locales(dossier)
        print(f"{len(pages)} fichier(s) à analyser dans {dossier}/")
        obtenues = 0
        for chemin, contenu in pages:
            etat = etat_next(contenu)
            if not etat:
                print(f"  ✗ {chemin} — aucun bloc __NEXT_DATA__")
                continue
            # L'URL n'est pas dans le fichier : on la reconstruit depuis le chemin produit.
            trouve = re.search(r'"articlePath"\s*:\s*"([^"]+)"', contenu)
            url = f"{BASE}/p/{trouve.group(1)}" if trouve else f"fichier://{chemin}"
            f = fiche(etat, url)
            if not f:
                print(f"  ✗ {chemin} — ce n'est pas une fiche produit")
                continue
            fiches[url] = f
            obtenues += 1
            print(f"  ✓ {f['titre'][:70]} — {f['prixTTC']} € — {len(f['images'])} image(s)")
        enregistre(fiches)
        print(f"\n{obtenues} fiche(s) extraite(s) → {SORTIE}")
        return 0

    # ─── collecte des URL a visiter ───
    if args.releve:
        cibles = urls_du_releve()
        print(f"{len(cibles)} URL dans le relevé.")
    elif args.categorie:
        print(f"Parcours de la catégorie sur {args.pages} page(s) :")
        cibles = urls_de_categorie(args.categorie, args.pages, args.delai)
        print(f"{len(cibles)} produit(s) trouvé(s).")
    else:
        cibles = [(u, None) for u in (args.url or [])]

    a_faire = [(u, i) for u, i in cibles if args.rejouer or u not in fiches]
    if args.limite:
        a_faire = a_faire[: args.limite]
    print(f"{len(a_faire)} fiche(s) à relever.\n")

    obtenues = 0
    echecs = 0
    for position, (url, id_catalogue) in enumerate(a_faire, start=1):
        print(f"[{position}/{len(a_faire)}] {url.rsplit('/', 1)[-1][:72]}")
        corps = recupere(url)
        if not corps:
            echecs += 1
            continue

        contenu = corps.decode("utf-8", errors="replace")
        etat = etat_next(contenu)
        f = fiche(etat, url) if etat else None

        if not f:
            # Echec silencieux interdit : on garde la page pour pouvoir
            # comprendre ce qui a change.
            DEBUG.mkdir(parents=True, exist_ok=True)
            nom = re.sub(r"[^a-z0-9]+", "-", url.rsplit("/", 1)[-1].lower())[:80]
            (DEBUG / f"{nom}.html").write_text(contenu, encoding="utf-8")
            raison = "pas de bloc __NEXT_DATA__" if not etat else "structure inattendue"
            print(f"    ✗ {raison} — page gardée dans {DEBUG}/")
            echecs += 1
            time.sleep(args.delai)
            continue

        ref = (id_catalogue or f.get("referenceManoMano") or url.rsplit("-", 1)[-1])
        f["dossierMedia"] = ref
        fiches[url] = f
        obtenues += 1

        print(f"    ✓ {str(f['titre'])[:66]}")
        print(f"      {f['prixTTC']} € TTC · {f['poidsKg']} kg · EAN {f['ean']} · {len(f['images'])} image(s)")
        if f["description"]:
            print(f"      description : {len(f['description'])} caractères")

        if not args.sans_images and f["images"]:
            # Les visuels d'une fiche deja au catalogue vont directement la ou
            # `media:scan` les attend ; les autres patientent a l'ecart.
            dossier = Path("public/img/products") / ref if id_catalogue else MEDIA / ref
            pris = telecharge_images(ref, f["images"], dossier, args.delai)
            print(f"      {pris} image(s) → {dossier}")

        # Enregistrement a chaque fiche : une interruption ne perd rien.
        enregistre(fiches)
        time.sleep(args.delai * random.uniform(0.8, 1.4))

    enregistre(fiches)
    print()
    print(f"{obtenues} fiche(s) relevée(s), {echecs} échec(s). Total : {len(fiches)}")
    print(f"Données  → {SORTIE}")
    if not args.sans_images:
        print(f"Visuels  → public/img/products/<id>/ (fiches du catalogue)")
        print(f"           {MEDIA}/<ref>/ (le reste)")
        print()
        print("Ensuite : npm run media:scan")
    if echecs:
        print()
        print(f"Les pages en échec sont dans {DEBUG}/ — envoyez-m'en une et j'adapte.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
