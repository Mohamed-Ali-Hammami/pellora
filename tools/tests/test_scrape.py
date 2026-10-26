#!/usr/bin/env python3
"""
Test de regression de tools/scrape.py.

    python3 tools/tests/test_scrape.py

Hors de la suite Vitest du site : `scrape.py` est un outil autonome, en
Python, sans rapport avec la boutique. Il a quand meme besoin d'un filet.

Les cas couverts sont ceux qui ont REELLEMENT casse pendant l'ecriture, et
c'est la seule raison pour laquelle ils sont la :

  — « 2490.00 » etait lu « 249 ». L'expression du montant offrait le choix
    entre « separateur de milliers » et « decimale », et le premier membre
    gagnait en consommant trois chiffres avant de renoncer au reste. Une
    erreur d'un facteur dix sur un prix de vente.
  — « salePrice » ne declenchait pas la detection du prix : la clef etait
    cherchee en snake_case alors que les API ecrivent en camelCase. Resultat,
    aucun prix sur les sites rendus cote navigateur.

Aucune dependance, aucun reseau : tout est en memoire.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("scrape", RACINE / "tools" / "scrape.py")
assert spec and spec.loader
scrape = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scrape)

echecs: list[str] = []


def verifie(intitule: str, obtenu: object, attendu: object) -> None:
    if obtenu == attendu:
        print(f"  ok   {intitule}")
    else:
        print(f"  ÉCHEC {intitule}\n        obtenu  : {obtenu!r}\n        attendu : {attendu!r}")
        echecs.append(intitule)


# ───────────────────────────── montants ─────────────────────────────

print("\nlecture des montants")
MONTANTS = [
    ("2490.00", 2490.00),          # le bug du facteur dix
    ("4190.50", 4190.50),
    ("1 349,90 €", 1349.90),       # espace comme séparateur de milliers
    ("1.234,56 €", 1234.56),       # notation continentale
    ("€1,234.56", 1234.56),        # notation anglo-saxonne
    ("89,90€", 89.90),
    ("1.234 €", 1234.0),           # point = milliers, pas décimale
    ("12.345,00 EUR", 12345.00),
    ("0,99 €", 0.99),
    ("1 234 567,89 €", 1234567.89),
    ("99 €", 99.0),
]
for brut, attendu in MONTANTS:
    lu = scrape.montant(brut)
    verifie(f"« {brut} »", round(lu[0], 2) if lu else None, attendu)

verifie("devise €", (scrape.montant("12,50 €") or (0, None))[1], "EUR")
verifie("devise EUR", (scrape.montant("12.50 EUR") or (0, None))[1], "EUR")
verifie("devise $", (scrape.montant("$12.50") or (0, None))[1], "USD")
verifie("texte sans montant", scrape.montant("aucun prix ici"), None)

# ─────────────────────── normalisation des clefs ───────────────────────

print("\nnormalisation des clefs")
verifie("salePrice", scrape.clef_plate("salePrice"), "sale_price")
verifie("currencyCode", scrape.clef_plate("currencyCode"), "currency_code")
verifie("price inchangé", scrape.clef_plate("price"), "price")
verifie("snake_case inchangé", scrape.clef_plate("unit_price"), "unit_price")

# ──────────────────── les cinq sources d'extraction ────────────────────

PAGES: dict[str, tuple[str, dict]] = {
    "json-ld": (
        """<html><head><title>x</title><script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Poêle Alpha 8 kW",
        "sku":"ALP-8","gtin13":"3760012345678","brand":{"@type":"Brand","name":"Alpha"},
        "description":"<p>Un poêle de 8 kW, <b>étanche</b>, pour 90 m².</p>",
        "image":["https://e.test/a1.jpg",{"@type":"ImageObject","url":"https://e.test/a2.webp"}],
        "offers":{"@type":"Offer","price":"2490.00","priceCurrency":"EUR"}}]}
        </script></head><body></body></html>""",
        {"titre": "Poêle Alpha 8 kW", "prix": 2490.0, "devise": "EUR",
         "marque": "Alpha", "ean": "3760012345678", "sku": "ALP-8", "nb_images": 2},
    ),
    "microdata": (
        """<html><body><div itemscope itemtype="http://schema.org/Product">
        <span itemprop="name">Insert Beta 10</span><img itemprop="image" src="/p/beta.jpg">
        <div itemprop="description">Insert de 10 kW en fonte, vitre panoramique, raccordement 150 mm.</div>
        <meta itemprop="priceCurrency" content="EUR"><span itemprop="price">1 349,90 €</span>
        </div></body></html>""",
        {"titre": "Insert Beta 10", "prix": 1349.90, "devise": "EUR", "nb_images": 1},
    ),
    "meta": (
        """<html><head>
        <meta property="og:title" content="Chaudière Gamma 24 kW">
        <meta property="og:description" content="Chaudière à granulés 24 kW avec eau chaude sanitaire.">
        <meta property="og:image" content="https://e.test/g.jpg">
        <meta property="product:price:amount" content="4190.50">
        <meta property="product:price:currency" content="EUR">
        </head><body></body></html>""",
        {"titre": "Chaudière Gamma 24 kW", "prix": 4190.50, "devise": "EUR", "nb_images": 1},
    ),
    "état js": (
        """<html><head><title>SPA</title></head><body><script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"product":{"title":"Cuisinière Delta",
        "longDescription":"Cuisinière à bois en acier émaillé, four de 40 litres, plaque de cuisson en fonte, puissance 9 kW. Raccordement arrière ou dessus.",
        "pricing":{"salePrice":1899.0,"currencyCode":"EUR"},
        "media":[{"imageUrl":"https://e.test/d1.jpg"},{"imageUrl":"https://e.test/d2.jpg"}]}}}}
        </script></body></html>""",
        {"titre": "Cuisinière Delta", "prix": 1899.0, "devise": "EUR", "nb_images": 2},
    ),
    "heuristique": (
        """<html><head><title>Thermostat Epsilon</title></head><body>
        <p>Prix : 79,90 €</p>
        <img src="/i/eps-800.jpg" srcset="/i/eps-400.jpg 400w, /i/eps-1600.jpg 1600w">
        <img src="/i/logo.svg"><img src="/px/tracking.gif">
        </body></html>""",
        {"titre": "Thermostat Epsilon", "prix": 79.90, "devise": "EUR", "nb_images": 3},
    ),
}

for source, (page, attendu) in PAGES.items():
    print(f"\nsource « {source} »")
    res = scrape.analyse(page)
    for champ, valeur in attendu.items():
        if champ == "nb_images":
            verifie("nombre d'images", len(res["images"]), valeur)
        elif champ == "prix":
            verifie("prix", round(res.get("prix") or 0, 2), valeur)
        else:
            verifie(champ, res.get(champ), valeur)
    if source != "heuristique":
        verifie("méthode du prix", res["methodes"].get("prix"), source)
    verifie("description non vide", bool(res.get("description")), source != "heuristique")

# ───────────────── le seuil qui separe description et libelle ─────────────────

print("\nseuil de longueur d'une description")
MODELE = (
    '<html><body><script type="application/json">'
    '{{"product":{{"title":"X","description":"{texte}","price":10}}}}'
    "</script></body></html>"
)
court = scrape.analyse(MODELE.format(texte="Description"))
verifie("libellé d'interface écarté", court.get("description"), None)
long_ = scrape.analyse(MODELE.format(texte="D" * scrape.DESC_MINI))
verifie("texte au seuil retenu", bool(long_.get("description")), True)

# ──────────────────────── filtrage des visuels ────────────────────────

print("\nfiltrage des visuels")
res = scrape.analyse(PAGES["heuristique"][0])
verifie("logo écarté", any("logo" in u for u in res["images"]), False)
verifie("pixel de suivi écarté", any("tracking" in u for u in res["images"]), False)
verifie("la plus grande d'abord", res["images"][0], "/i/eps-1600.jpg")
verifie("classées par taille", res["images"], ["/i/eps-1600.jpg", "/i/eps-800.jpg", "/i/eps-400.jpg"])

# ───────────────────────────── conclusion ─────────────────────────────

print()
if echecs:
    print(f"{len(echecs)} échec(s) : {', '.join(echecs)}")
    sys.exit(1)
print("tout passe.")
