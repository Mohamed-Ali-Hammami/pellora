#!/usr/bin/env python3
"""
Extrait titre, description, prix et images de n'importe quelle page produit.

    python3 tools/scrape.py <url> [<url>...]
    python3 tools/scrape.py --fichier urls.txt --images
    python3 tools/scrape.py --html-dir pages/            # hors ligne
    python3 tools/scrape.py <url> --json                 # sortie brute

Outil autonome : aucune dependance, aucun rapport avec un site en
particulier. urllib de la bibliotheque standard, c'est tout.

COMMENT IL S'Y PREND, ET POURQUOI DANS CET ORDRE.

Scraper par selecteurs CSS ne marche que sur un site, et casse a la premiere
refonte. Le script ne fait donc pas ca. Il essaie cinq sources de donnees, de
la plus normalisee a la plus bricolee, et s'arrete des qu'un champ est rempli :

  1. JSON-LD schema.org/Product. Le standard que Google impose de fait pour
     apparaitre dans les resultats enrichis : la plupart des boutiques
     sérieuses le publient, et il donne nom, description, images, prix,
     devise, marque, SKU et GTIN d'un coup.
  2. Microdata et RDFa (itemprop="price"). Plus ancien, encore tres repandu.
  3. Metadonnees OpenGraph et Twitter Card. Mises la pour les reseaux
     sociaux, donc presentes meme sur des pages pauvres : og:title,
     og:description, og:image, product:price:amount.
  4. L'etat des applications JavaScript : __NEXT_DATA__, __NUXT__,
     __INITIAL_STATE__, et plus largement TOUT bloc <script> contenant du
     JSON. Le script le parcourt en profondeur a la recherche de clefs qui
     ressemblent a un prix, une description ou une image. C'est ce qui permet
     de lire les sites rendus cote navigateur sans navigateur.
  5. En dernier recours, l'heuristique : expression reguliere sur les
     montants, <title>, meta description, et les plus grandes images de la
     page.

Chaque champ du resultat porte la methode qui l'a trouve. Quand rien ne sort,
la page est conservee pour qu'on puisse regarder, plutot que de renvoyer un
resultat vide sans explication.

CE QU'IL NE PEUT PAS FAIRE. Une page dont le contenu n'arrive qu'apres
l'execution du JavaScript, sans aucun JSON dans le HTML initial, est hors de
portee : il faut un vrai navigateur. Le script le dit au lieu de renvoyer des
champs vides.
"""

from __future__ import annotations

import argparse
import gzip
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from html.parser import HTMLParser
from pathlib import Path

ENTETES = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,es;q=0.7",
    "Accept-Encoding": "gzip, deflate",
}

# Devises reconnues, symbole ou code. L'euro d'abord : c'est le cas courant.
DEVISES = {
    "€": "EUR", "EUR": "EUR", "$": "USD", "USD": "USD", "£": "GBP", "GBP": "GBP",
    "CHF": "CHF", "PLN": "PLN", "SEK": "SEK", "DKK": "DKK", "NOK": "NOK", "CZK": "CZK",
}

# Un montant : « 1.234,56 € », « €1,234.56 », « 1234.56 EUR », « 89,90€ ».
#
# Le nombre est capture GLOUTONNEMENT, separateurs compris, et interprete
# ensuite par `montant()`. Une alternance « milliers ou decimal » paraissait
# plus propre, mais elle lisait « 2490.00 » comme « 249 » : le premier membre
# consommait trois chiffres puis renoncait au reste. Tout prendre, puis
# decider, est la seule facon fiable.
MONTANT = re.compile(
    r"(?:(?P<sym1>[€$£])\s*)?"
    r"(?P<nombre>\d[\d \u00a0.,]*\d|\d)"
    r"(?:\s*(?P<sym2>[€$£])|\s*(?P<code>EUR|USD|GBP|CHF|PLN|SEK|DKK|NOK|CZK)\b)?"
)

CLEFS_PRIX = re.compile(r"(?:^|_)(price|prix|precio|preis|amount|montant)", re.I)
CLEFS_DESC = re.compile(r"(descri|longdesc|summary|resume|detail)", re.I)
CLEFS_IMG = re.compile(r"(image|img|photo|visuel|media|picture|thumbnail)", re.I)
CLEFS_TITRE = re.compile(r"(^title$|^name$|^titre$|^nombre$|productname|product_name)", re.I)


def clef_plate(clef: str) -> str:
    """« salePrice » → « sale_price ».

    Les clefs d'une API sont en camelCase, celles d'un flux en snake_case, et
    le meme champ s'ecrit donc des deux facons. Sans cette normalisation,
    `CLEFS_PRIX` ratait « salePrice » et laissait le prix introuvable sur tout
    site rendu cote navigateur — c'est-a-dire sur la moitie du web.
    """
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", clef).lower()

# Longueur a partir de laquelle une chaine portee par une clef « descri... »
# est traitee comme une description.
#
# En dessous, c'est presque toujours un libelle d'interface (« Description »,
# « Voir le detail »), un nom d'onglet ou une etiquette de formulaire. Les
# retenir remplirait le champ avec du vocabulaire de navigation, ce qui est
# pire qu'un champ vide : on ne verrait pas qu'il manque.
DESC_MINI = 80

IMAGE_EXT = re.compile(r"\.(jpe?g|png|webp|avif|gif)(?:[?#]|$)", re.I)
# Les pixels de suivi, icones et logos ne sont pas des visuels produit.
IMAGE_BRUIT = re.compile(
    r"(sprite|icon|logo|favicon|pixel|tracking|placeholder|avatar|flag|badge|1x1|blank)",
    re.I,
)


# ════════════════════════════════ reseau ════════════════════════════════


def recupere(url: str, essais: int = 3, delai: float = 1.5) -> tuple[str | None, str | None]:
    """Le HTML d'une page, ou (None, raison)."""
    for essai in range(essais):
        try:
            requete = urllib.request.Request(url, headers=ENTETES)
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                corps = reponse.read()
                codage = (reponse.headers.get("Content-Encoding") or "").lower()
                if codage == "gzip":
                    corps = gzip.decompress(corps)
                elif codage == "deflate":
                    corps = zlib.decompress(corps, -zlib.MAX_WBITS)
                elif codage == "br":
                    return None, "réponse compressée en brotli : relancez avec --no-brotli"
                jeu = reponse.headers.get_content_charset() or "utf-8"
                return corps.decode(jeu, errors="replace"), None
        except urllib.error.HTTPError as erreur:
            if erreur.code in (401, 403, 404, 410):
                return None, f"HTTP {erreur.code}"
            time.sleep(delai * (2 ** essai))
        except Exception as erreur:  # noqa: BLE001
            if essai == essais - 1:
                return None, f"{type(erreur).__name__}: {erreur}"
            time.sleep(delai * (2 ** essai))
    return None, "abandon après plusieurs tentatives"


# ═══════════════════════════ analyse du HTML ═══════════════════════════


class Collecteur(HTMLParser):
    """Relève metas, scripts, images, microdata et le titre, en une passe."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.metas: list[dict[str, str]] = []
        self.scripts: list[tuple[str, str]] = []  # (type, contenu)
        self.images: list[dict[str, str]] = []
        self.microdata: list[tuple[str, str]] = []  # (itemprop, valeur)
        self.titre: str | None = None
        self._dans_titre = False
        self._script: list[str] | None = None
        self._script_type = ""
        self._microprop: str | None = None
        self._microtexte: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._dans_titre = True
        elif tag == "meta":
            self.metas.append(a)
        elif tag == "script":
            self._script = []
            self._script_type = a.get("type", "").lower()
        elif tag in ("img", "source"):
            self.images.append(a)
        elif tag == "link" and a.get("rel", "").lower() in ("image_src", "preload"):
            if a.get("href"):
                self.images.append({"src": a["href"]})

        # Microdata : la valeur peut etre dans content, ou dans le texte.
        prop = a.get("itemprop") or a.get("property", "") if tag != "meta" else a.get("itemprop", "")
        if prop:
            valeur = a.get("content") or a.get("src") or a.get("href") or ""
            if valeur:
                self.microdata.append((prop, valeur))
            else:
                self._microprop = prop
                self._microtexte = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._dans_titre = False
        elif tag == "script" and self._script is not None:
            self.scripts.append((self._script_type, "".join(self._script)))
            self._script = None
        elif self._microprop:
            texte = "".join(self._microtexte).strip()
            if texte:
                self.microdata.append((self._microprop, texte))
            self._microprop = None

    def handle_data(self, data: str) -> None:
        if self._dans_titre:
            self.titre = (self.titre or "") + data
        if self._script is not None:
            self._script.append(data)
        if self._microprop is not None:
            self._microtexte.append(data)


def texte_simple(code: str) -> str:
    """HTML → texte lisible, paragraphes conservés."""
    t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", code)
    t = re.sub(r"(?i)<\s*br\s*/?>", "\n", t)
    t = re.sub(r"(?i)</\s*(p|li|div|tr|h[1-6])\s*>", "\n", t)
    t = re.sub(r"(?i)<\s*li[^>]*>", "— ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\xa0", " ")
    lignes = [re.sub(r"[ \t]+", " ", l).strip() for l in t.split("\n")]
    return "\n".join(l for l in lignes if l)


def montant(texte: str) -> tuple[float, str | None] | None:
    """Premier montant plausible d'une chaîne, avec sa devise si donnée."""
    if not isinstance(texte, str):
        return None
    trouve = MONTANT.search(texte)
    if not trouve:
        return None
    brut = trouve.group("nombre")
    devise = trouve.group("sym1") or trouve.group("sym2") or trouve.group("code")

    # Séparateurs. Une ponctuation suivie d'exactement 3 chiffres jusqu'à la
    # fin est un séparateur de milliers (« 1.234 »), pas une décimale ; suivie
    # de 1 ou 2 chiffres, c'est la décimale (« 89,90 »). Les deux notations,
    # « 1.234,56 » et « 1,234.56 », donnent donc 1234.56.
    nombre = brut.replace(" ", "").replace("\u00a0", "").rstrip(".,")
    decimale = re.search(r"[.,](\d{1,2})$", nombre)
    if decimale and not re.search(r"[.,]\d{3}$", nombre):
        entier = re.sub(r"[.,]", "", nombre[: decimale.start()])
        nombre = f"{entier or '0'}.{decimale.group(1)}"
    else:
        nombre = re.sub(r"[.,]", "", nombre)
    try:
        valeur = float(nombre)
    except ValueError:
        return None
    if valeur <= 0 or valeur > 10_000_000:
        return None
    return valeur, DEVISES.get(devise or "", None)


# ═══════════════════════════ 1. JSON-LD ═══════════════════════════


def json_ld(scripts: list[tuple[str, str]]) -> list[dict]:
    """Tous les objets JSON-LD de la page, aplatis (@graph compris)."""
    sortie: list[dict] = []

    def ajoute(obj: object) -> None:
        if isinstance(obj, list):
            for o in obj:
                ajoute(o)
        elif isinstance(obj, dict):
            if "@graph" in obj:
                ajoute(obj["@graph"])
            sortie.append(obj)
            for valeur in obj.values():
                if isinstance(valeur, (dict, list)):
                    ajoute(valeur)

    for type_, contenu in scripts:
        if "ld+json" not in type_:
            continue
        brut = contenu.strip()
        if not brut:
            continue
        try:
            ajoute(json.loads(brut))
        except json.JSONDecodeError:
            # Certains sites concatènent plusieurs objets, ou laissent des
            # virgules traînantes. On tente un repêchage objet par objet.
            for bout in re.findall(r"\{.*?\}(?=\s*[,\]]|\s*$)", brut, re.S):
                try:
                    ajoute(json.loads(bout))
                except json.JSONDecodeError:
                    continue
    return sortie


def est_produit(obj: dict) -> bool:
    t = obj.get("@type")
    types = [t] if isinstance(t, str) else (t if isinstance(t, list) else [])
    return any(isinstance(x, str) and x.lower() in ("product", "productmodel", "offer") for x in types)


def depuis_json_ld(objets: list[dict]) -> dict:
    res: dict = {}
    produits = [o for o in objets if est_produit(o)] or objets
    for obj in produits:
        if "titre" not in res and isinstance(obj.get("name"), str):
            res["titre"] = obj["name"].strip()
        if "description" not in res and isinstance(obj.get("description"), str):
            res["description"] = texte_simple(obj["description"])
        if "marque" not in res:
            marque = obj.get("brand")
            if isinstance(marque, dict):
                marque = marque.get("name")
            if isinstance(marque, str):
                res["marque"] = marque.strip()
        for clef, cible in (("sku", "sku"), ("mpn", "referenceFabricant"), ("gtin13", "ean"),
                            ("gtin", "ean"), ("gtin12", "ean"), ("gtin8", "ean")):
            if cible not in res and isinstance(obj.get(clef), (str, int)):
                res[cible] = str(obj[clef]).strip()
        if "images" not in res:
            images = obj.get("image")
            liste: list[str] = []
            for im in (images if isinstance(images, list) else [images]):
                if isinstance(im, str):
                    liste.append(im)
                elif isinstance(im, dict) and isinstance(im.get("url"), str):
                    liste.append(im["url"])
            if liste:
                res["images"] = liste
        if "prix" not in res:
            offres = obj.get("offers")
            for offre in (offres if isinstance(offres, list) else [offres]):
                if not isinstance(offre, dict):
                    continue
                for clef in ("price", "lowPrice", "highPrice"):
                    brut = offre.get(clef)
                    if brut is None:
                        continue
                    lu = montant(str(brut))
                    if lu:
                        res["prix"] = lu[0]
                        devise = offre.get("priceCurrency") or lu[1]
                        if isinstance(devise, str):
                            res["devise"] = devise.upper()
                        break
                if "prix" in res:
                    break
            if "prix" not in res and obj.get("price") is not None:
                lu = montant(str(obj["price"]))
                if lu:
                    res["prix"] = lu[0]
                    if obj.get("priceCurrency"):
                        res["devise"] = str(obj["priceCurrency"]).upper()
    return res


# ═════════════════════ 2. microdata · 3. metadonnees ═════════════════════


def depuis_microdata(paires: list[tuple[str, str]]) -> dict:
    res: dict = {}
    for prop, valeur in paires:
        p = prop.split("/")[-1].lower()
        if p == "price" and "prix" not in res:
            lu = montant(valeur)
            if lu:
                res["prix"] = lu[0]
                if lu[1]:
                    res.setdefault("devise", lu[1])
        elif p == "pricecurrency":
            res.setdefault("devise", valeur.strip().upper()[:3])
        elif p in ("name", "title") and "titre" not in res:
            res["titre"] = valeur.strip()
        elif p == "description" and "description" not in res:
            res["description"] = texte_simple(valeur)
        elif p == "image":
            res.setdefault("images", []).append(valeur)
        elif p == "brand" and "marque" not in res:
            res["marque"] = valeur.strip()
        elif p in ("gtin13", "gtin", "gtin12") and "ean" not in res:
            res["ean"] = valeur.strip()
        elif p in ("sku", "mpn") and "sku" not in res:
            res["sku"] = valeur.strip()
    return res


def depuis_metas(metas: list[dict[str, str]]) -> dict:
    res: dict = {}
    par_nom = {}
    for m in metas:
        clef = (m.get("property") or m.get("name") or m.get("itemprop") or "").lower()
        if clef and m.get("content"):
            par_nom.setdefault(clef, m["content"])

    for clef in ("og:title", "twitter:title"):
        if par_nom.get(clef):
            res["titre"] = par_nom[clef].strip()
            break
    for clef in ("og:description", "twitter:description", "description"):
        if par_nom.get(clef):
            res["description"] = texte_simple(par_nom[clef])
            break
    for clef in ("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"):
        if par_nom.get(clef):
            res.setdefault("images", []).append(par_nom[clef])
    for clef in ("product:price:amount", "og:price:amount", "twitter:data1"):
        lu = montant(par_nom.get(clef, ""))
        if lu:
            res["prix"] = lu[0]
            if lu[1]:
                res.setdefault("devise", lu[1])
            break
    for clef in ("product:price:currency", "og:price:currency"):
        if par_nom.get(clef):
            res.setdefault("devise", par_nom[clef].strip().upper()[:3])
            break
    return res


# ═══════════════ 4. l'etat des applications JavaScript ═══════════════


def blocs_json(scripts: list[tuple[str, str]]) -> list[object]:
    """Tout JSON trouvable dans les <script>, quelle que soit sa forme."""
    sortie: list[object] = []
    for type_, contenu in scripts:
        if "ld+json" in type_:
            continue
        brut = contenu.strip()
        if not brut or len(brut) < 40:
            continue

        # a) le script EST du JSON (__NEXT_DATA__ et compagnie).
        if "json" in type_ or brut[0] in "{[":
            try:
                sortie.append(json.loads(brut))
                continue
            except json.JSONDecodeError:
                pass

        # b) une affectation : window.__X__ = {...};
        for trouve in re.finditer(
            r"(?:window|self|globalThis)\.[A-Za-z_$][\w$]*\s*=\s*(\{.*?\})\s*[;\n]",
            brut,
            re.S,
        ):
            try:
                sortie.append(json.loads(trouve.group(1)))
            except json.JSONDecodeError:
                continue

        # c) JSON.parse("...") : chaîne échappée.
        for trouve in re.finditer(r'JSON\.parse\(\s*"((?:\\.|[^"\\])*)"\s*\)', brut):
            try:
                sortie.append(json.loads(json.loads(f'"{trouve.group(1)}"')))
            except (json.JSONDecodeError, ValueError):
                continue
    return sortie


def fouille(objets: list[object], base: str) -> dict:
    """Parcourt en profondeur et retient ce qui ressemble aux champs cherchés.

    Volontairement prudent : on ne garde un prix que s'il est plausible et
    porté par une clef qui le nomme, jamais un nombre trouvé au hasard.
    """
    res: dict = {}
    images: list[str] = []

    def absolue(u: str) -> str:
        return urllib.parse.urljoin(base, u) if base else u

    def visite(noeud: object, profondeur: int = 0) -> None:
        if profondeur > 14:
            return
        if isinstance(noeud, list):
            for element in noeud[:400]:
                visite(element, profondeur + 1)
            return
        if not isinstance(noeud, dict):
            return
        for clef, valeur in noeud.items():
            if not isinstance(clef, str):
                continue
            if isinstance(valeur, (dict, list)):
                visite(valeur, profondeur + 1)
                continue
            if isinstance(valeur, bool) or valeur is None:
                continue

            plate = clef_plate(clef)

            if CLEFS_PRIX.search(plate) and "prix" not in res:
                # On ignore ce qui n'est pas un prix de vente.
                if re.search(r"(id|code|type|list|range|currency|devise|per|unit)$", plate, re.I):
                    continue
                lu = montant(str(valeur))
                if lu and 0.5 <= lu[0] <= 1_000_000:
                    res["prix"] = lu[0]
                    res.setdefault("_prixClef", clef)
                    if lu[1]:
                        res.setdefault("devise", lu[1])
            elif re.fullmatch(r"(currency|price_currency|devise|currency_code)", plate, re.I):
                if isinstance(valeur, str) and len(valeur) == 3:
                    res.setdefault("devise", valeur.upper())
            elif CLEFS_DESC.search(plate) and isinstance(valeur, str) and len(valeur) >= DESC_MINI:
                if "description" not in res:
                    res["description"] = texte_simple(valeur)
            elif CLEFS_TITRE.search(plate) and isinstance(valeur, str) and 3 < len(valeur) < 300:
                res.setdefault("titre", valeur.strip())
            elif CLEFS_IMG.search(plate) and isinstance(valeur, str):
                if IMAGE_EXT.search(valeur) or valeur.startswith(("http", "//", "/")):
                    if IMAGE_EXT.search(valeur) and not IMAGE_BRUIT.search(valeur):
                        images.append(absolue(valeur))

    for objet in objets:
        visite(objet)
    if images:
        res["images"] = images
    return res


# ═══════════════════════ 5. heuristique, en dernier ═══════════════════════


def images_du_html(collecteur: Collecteur, base: str) -> list[str]:
    """Visuels de la page, les plus grandes variantes d'abord."""
    trouvees: list[tuple[int, str]] = []
    vues: set[str] = set()

    def ajoute(url: str, largeur: int) -> None:
        if not url or url.startswith("data:"):
            return
        complete = urllib.parse.urljoin(base, url.strip()) if base else url.strip()
        if complete in vues or IMAGE_BRUIT.search(complete):
            return
        vues.add(complete)
        trouvees.append((largeur, complete))

    for attrs in collecteur.images:
        # srcset : « url 800w, url 1600w » — on garde la plus large.
        for champ in ("srcset", "data-srcset", "imagesrcset"):
            for bout in attrs.get(champ, "").split(","):
                morceaux = bout.strip().split()
                if not morceaux:
                    continue
                largeur = 0
                if len(morceaux) > 1 and morceaux[1].endswith("w"):
                    largeur = int(re.sub(r"\D", "", morceaux[1]) or 0)
                ajoute(morceaux[0], largeur)
        for champ in ("src", "data-src", "data-original", "data-lazy-src", "href"):
            url = attrs.get(champ)
            if not url:
                continue
            try:
                largeur = int(re.sub(r"\D", "", attrs.get("width", "")) or 0)
            except ValueError:
                largeur = 0
            if largeur == 0:
                # Faute d'attribut `width`, on lit la taille dans le nom du
                # fichier : « photo-1600.jpg », « x_800x800.webp ». C'est une
                # convention, pas une garantie — d'où l'usage limité au seul
                # CLASSEMENT. Une erreur ici ne fait que proposer une autre
                # image en premier, jamais retenir une mauvaise URL.
                tailles = [int(n) for n in re.findall(r"(?<!\d)(\d{2,4})(?!\d)", url)]
                plausibles = [n for n in tailles if 50 <= n <= 4000]
                largeur = max(plausibles) if plausibles else 0
            ajoute(url, largeur)

    retenues = [u for _, u in sorted(trouvees, key=lambda t: -t[0]) if IMAGE_EXT.search(u)]
    sans_ext = [u for _, u in trouvees if not IMAGE_EXT.search(u)]
    return retenues + sans_ext[:10]


def prix_heuristique(page: str) -> dict:
    """Dernier recours : un montant près d'un mot qui annonce un prix."""
    texte = texte_simple(page)
    indices = re.finditer(
        r"(?i)(prix|price|precio|preis|tarif|montant|total|a partir de|desde|ab)\D{0,20}"
        r"([€$£]?\s?\d[\d \u00a0.,]{0,12}\d\s?(?:[€$£]|EUR|USD|GBP)?)",
        texte,
    )
    for indice in indices:
        lu = montant(indice.group(2))
        if lu:
            return {"prix": lu[0], **({"devise": lu[1]} if lu[1] else {})}
    # Sinon, le premier montant accompagné d'une devise explicite.
    for trouve in MONTANT.finditer(texte):
        if trouve.group("sym1") or trouve.group("sym2") or trouve.group("code"):
            lu = montant(trouve.group(0))
            if lu:
                return {"prix": lu[0], **({"devise": lu[1]} if lu[1] else {})}
    return {}


# ═══════════════════════════ assemblage ═══════════════════════════


def analyse(page: str, url: str = "") -> dict:
    """Le résultat, champ par champ, avec la méthode qui a trouvé chacun."""
    collecteur = Collecteur()
    try:
        collecteur.feed(page)
    except Exception:  # noqa: BLE001 — du HTML cassé ne doit pas tout arrêter
        pass

    base = url
    for m in collecteur.metas:
        if (m.get("property") or "").lower() == "og:url" and m.get("content"):
            base = m["content"]
            break

    sources = (
        ("json-ld", depuis_json_ld(json_ld(collecteur.scripts))),
        ("microdata", depuis_microdata(collecteur.microdata)),
        ("meta", depuis_metas(collecteur.metas)),
        ("état js", fouille(blocs_json(collecteur.scripts), base)),
    )

    res: dict = {"url": url or None}
    methodes: dict[str, str] = {}
    images: list[str] = []

    for nom, donnees in sources:
        for clef, valeur in donnees.items():
            if clef.startswith("_"):
                continue
            if clef == "images":
                images.extend(valeur if isinstance(valeur, list) else [valeur])
                methodes.setdefault("images", nom)
                continue
            if clef not in res or res.get(clef) in (None, ""):
                res[clef] = valeur
                methodes[clef] = nom

    # Heuristique : seulement pour ce qui manque encore.
    if not res.get("titre") and collecteur.titre:
        res["titre"] = re.sub(r"\s+", " ", collecteur.titre).strip()
        methodes["titre"] = "balise title"
    if not res.get("prix"):
        trouve = prix_heuristique(page)
        if trouve:
            res.update({k: v for k, v in trouve.items() if k not in res or not res[k]})
            methodes["prix"] = "heuristique"
    if not images:
        images = images_du_html(collecteur, base)
        if images:
            methodes["images"] = "balises img"

    # Dédoublonnage en gardant l'ordre, et URL absolues.
    vues, propres = set(), []
    for u in images:
        if not isinstance(u, str):
            continue
        complete = urllib.parse.urljoin(base, u.strip()) if base else u.strip()
        if complete and complete not in vues and not complete.startswith("data:"):
            vues.add(complete)
            propres.append(complete)
    res["images"] = propres
    res["methodes"] = methodes
    res["complet"] = bool(res.get("titre") and res.get("prix") and res.get("images"))
    return res


# ═══════════════════════════ telechargement ═══════════════════════════


def nom_dossier(res: dict, url: str) -> str:
    base = res.get("sku") or res.get("ean")
    if not base:
        chemin = urllib.parse.urlparse(url).path.strip("/").split("/")[-1] or "page"
        base = chemin
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(base))[:80] or "page"


def telecharge(urls: list[str], dossier: Path, maximum: int, delai: float) -> int:
    dossier.mkdir(parents=True, exist_ok=True)
    pris = 0
    for position, url in enumerate(urls[:maximum], start=1):
        suffixe = (Path(urllib.parse.urlparse(url).path).suffix or ".jpg")[:5]
        cible = dossier / f"{position:02d}{suffixe}"
        if cible.exists() and cible.stat().st_size > 0:
            pris += 1
            continue
        try:
            requete = urllib.request.Request(url, headers=ENTETES)
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                corps = reponse.read()
            if len(corps) < 1024:  # une image de moins d'1 Ko est un pixel de suivi
                continue
            cible.write_bytes(corps)
            pris += 1
        except Exception:  # noqa: BLE001
            continue
        time.sleep(delai * 0.5)
    return pris


# ═══════════════════════════ principal ═══════════════════════════


def console_en_utf8() -> None:
    """La console Windows est en cp1252 : un accent la ferait planter."""
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError, OSError):
            pass


def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("url", nargs="*", help="une ou plusieurs pages")
    p.add_argument("--fichier", help="fichier texte, une URL par ligne")
    p.add_argument("--html-dir", help="analyser des pages HTML locales (hors ligne)")
    p.add_argument("--images", action="store_true", help="télécharger les visuels")
    p.add_argument("--max-images", type=int, default=10, help="visuels par produit (défaut 10)")
    p.add_argument("--sortie", default="scraped", help="dossier de sortie (défaut « scraped »)")
    p.add_argument("--delai", type=float, default=1.5, help="secondes entre deux pages")
    p.add_argument("--json", action="store_true", help="afficher le JSON brut sur la sortie standard")
    args = p.parse_args()
    console_en_utf8()

    cibles: list[tuple[str, str | None]] = [(u, None) for u in args.url]
    if args.fichier:
        for ligne in Path(args.fichier).read_text(encoding="utf-8").splitlines():
            ligne = ligne.strip()
            if ligne and not ligne.startswith("#"):
                cibles.append((ligne, None))
    if args.html_dir:
        dossier = Path(args.html_dir)
        if not dossier.is_dir():
            print(f"Dossier introuvable : {dossier}", file=sys.stderr)
            return 1
        for fichier in sorted(dossier.rglob("*")):
            if fichier.suffix.lower() in (".html", ".htm", ".txt"):
                cibles.append((str(fichier), fichier.read_text(encoding="utf-8", errors="replace")))

    if not cibles:
        p.print_help()
        return 1

    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    resultats: list[dict] = []
    echecs: list[tuple[str, str]] = []

    for position, (cible, contenu) in enumerate(cibles, start=1):
        if not args.json:
            print(f"[{position}/{len(cibles)}] {cible[:88]}")

        if contenu is None:
            contenu, raison = recupere(cible, delai=args.delai)
            if contenu is None:
                echecs.append((cible, raison or "inconnu"))
                if not args.json:
                    print(f"      ✗ {raison}")
                continue

        res = analyse(contenu, cible if cible.startswith("http") else "")
        resultats.append(res)

        if not args.json:
            devise = res.get("devise") or ""
            prix = f"{res['prix']:.2f} {devise}".strip() if res.get("prix") else "—"
            desc = res.get("description") or ""
            print(f"      titre : {(res.get('titre') or '—')[:72]}")
            print(f"      prix  : {prix}   ({res['methodes'].get('prix', 'introuvable')})")
            print(f"      desc  : {len(desc)} car.   ({res['methodes'].get('description', 'introuvable')})")
            print(f"      images: {len(res['images'])}   ({res['methodes'].get('images', 'introuvable')})")
            if not res["complet"]:
                manque = [c for c in ("titre", "prix", "images") if not res.get(c)]
                print(f"      ⚠ incomplet : {', '.join(manque)} introuvable(s)")
                brut = sortie / "_pages"
                brut.mkdir(parents=True, exist_ok=True)
                (brut / f"{nom_dossier(res, cible)}.html").write_text(contenu, encoding="utf-8")

        if args.images and res["images"]:
            dossier = sortie / "images" / nom_dossier(res, cible)
            pris = telecharge(res["images"], dossier, args.max_images, args.delai)
            if not args.json:
                print(f"      {pris} image(s) → {dossier}")

        if cible.startswith("http"):
            time.sleep(args.delai)

    fichier_json = sortie / "produits.json"
    fichier_json.write_text(
        json.dumps(resultats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    if args.json:
        print(json.dumps(resultats, ensure_ascii=False, indent=2))
        return 0

    complets = sum(1 for r in resultats if r["complet"])
    print()
    print(f"{len(resultats)} page(s) analysée(s), {complets} complète(s), {len(echecs)} échec(s).")
    print(f"→ {fichier_json}")
    if echecs:
        print()
        for cible, raison in echecs[:10]:
            print(f"  ✗ {raison:28} {cible[:60]}")
    incomplets = len(resultats) - complets
    if incomplets:
        print()
        print(f"{incomplets} page(s) incomplète(s) : le HTML est gardé dans {sortie}/_pages/.")
        print("Une page dont le contenu n'arrive qu'après le JavaScript demande un")
        print("vrai navigateur — envoyez-m'en une et je regarde.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
