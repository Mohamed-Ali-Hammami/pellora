#!/usr/bin/env python3
"""
Cherche sur Open Icecat les fiches des produits releves, par leur EAN.

    export ICECAT_USER=votre-identifiant
    python3 scripts/icecat_lookup.py                    # tous les EAN releves
    python3 scripts/icecat_lookup.py --limite 20        # mesurer la couverture
    python3 scripts/icecat_lookup.py --ean 4251776910314

POURQUOI PASSER PAR ICECAT.

Les photos et descriptions d'une place de marche appartiennent a ses vendeurs :
les reprendre telles quelles, c'est republier le travail d'autrui. Icecat est
l'autre chemin. C'est un syndicateur de contenu produit : les fabricants y
deposent eux-memes leurs fiches - textes traduits, visuels, caracteristiques -
pour que leurs revendeurs s'en servent. Open Icecat, la partie gratuite, est
distribuee sous licence de contenu ouvert, et les fiches y sont approuvees par
la marque qui les fournit.

Le pont entre les deux, c'est l'EAN. Le code-barres n'appartient a personne :
c'est un identifiant. `scrape_manomano.py` le releve, ce script s'en sert pour
retrouver le MEME article dans un catalogue dont le contenu est, lui,
utilisable.

CE QUE CE SCRIPT SERT D'ABORD A SAVOIR.

Icecat s'est construit sur l'informatique et l'electronique. Sa couverture en
chauffage est une inconnue, et aucune page commerciale ne la donne : elle se
mesure. Lancez-le sur vingt EAN et vous saurez, en deux minutes, si cette voie
vaut la peine d'etre suivie pour votre catalogue. Trois reponses possibles :

    trouve   la fiche existe en Open Icecat, elle est recuperee ;
    403      la marque n'est que dans Full Icecat, l'offre payante ;
    404      le produit n'est pas dans le catalogue.

PRUDENCE SUR L'ADRESSE DE L'API. Icecat documente plusieurs points d'entree et
le nom du parametre d'EAN varie selon la version de la documentation. Le script
essaie donc plusieurs variantes et vous dit laquelle a repondu, plutot que de
supposer. Si aucune ne marche, la documentation officielle est ici :
https://iceclog.com/manual-for-icecat-json-product-requests/
et l'inscription (gratuite) sur https://icecat.biz/en/menu/channelpartners
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RELEVES = Path("data/releves")
FICHES = RELEVES / "manomano-fiches.json"
SORTIE = RELEVES / "icecat-fiches.json"

LANGUES = ("FR", "EN", "NL", "ES")

ENTETES = {
    "User-Agent": "pellora-store/1.0 (recherche de contenu produit sous licence)",
    "Accept": "application/json, text/xml;q=0.9, */*;q=0.8",
}

# Variantes essayees dans l'ordre. Chacune est une (description, fabrique d'URL).
# Le nom du parametre d'EAN differe d'une page de documentation a l'autre :
# plutot que de parier, on essaie et on rapporte ce qui a repondu.
def variantes(ean: str, langue: str, user: str) -> list[tuple[str, str]]:
    q = urllib.parse.quote
    return [
        (
            "JSON live, GTIN",
            f"https://live.icecat.biz/api?UserName={q(user)}&Language={q(langue)}"
            f"&GTIN={q(ean)}&Content=all",
        ),
        (
            "XML s3, ean_upc",
            f"https://data.icecat.biz/xml_s3/xml_server3.cgi?ean_upc={q(ean)}"
            f"&lang={q(langue)}&output=productxml&UserName={q(user)}",
        ),
        (
            "XML s3, GTIN",
            f"https://data.icecat.biz/xml_s3/xml_server3.cgi?GTIN={q(ean)}"
            f"&lang={q(langue)}&output=productxml&UserName={q(user)}",
        ),
    ]


def appelle(url: str) -> tuple[int, bytes | None]:
    try:
        requete = urllib.request.Request(url, headers=ENTETES)
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            return reponse.status, reponse.read()
    except urllib.error.HTTPError as erreur:
        return erreur.code, erreur.read() if erreur.fp else None
    except Exception as erreur:  # noqa: BLE001
        print(f"      {type(erreur).__name__}: {erreur}")
        return 0, None


def extrait_json(corps: bytes) -> dict | None:
    """Les champs utiles d'une reponse JSON Icecat, si elle en est une."""
    try:
        data = json.loads(corps)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    # Icecat enveloppe le produit sous « data » ; une erreur arrive sous « msg ».
    bloc = data.get("data") if isinstance(data.get("data"), dict) else data
    if not isinstance(bloc, dict):
        return None
    general = bloc.get("GeneralInfo") or {}
    images = bloc.get("Gallery") or []
    return {
        "titre": general.get("Title") or general.get("ProductName"),
        "marque": (general.get("Brand") or general.get("Vendor")),
        "descriptionCourte": (general.get("SummaryDescription") or {}).get("ShortSummaryDescription"),
        "descriptionLongue": (general.get("SummaryDescription") or {}).get("LongSummaryDescription"),
        "descriptionMarketing": (general.get("Description") or {}).get("LongDesc"),
        "images": [
            im.get("Pic") or im.get("HighPic") or im.get("LowPic")
            for im in images
            if isinstance(im, dict) and (im.get("Pic") or im.get("HighPic") or im.get("LowPic"))
        ],
        "caracteristiques": [
            {
                "nom": (g.get("Feature") or {}).get("Name", {}).get("Value") if isinstance(g.get("Feature"), dict) else None,
                "valeur": g.get("PresentationValue"),
            }
            for g in (bloc.get("FeaturesGroups") or [])
            if isinstance(g, dict)
        ] or None,
    }


def eans_du_releve() -> list[tuple[str, str | None]]:
    """(ean, titre) depuis les fiches relevees. Sans EAN, pas de recherche."""
    if not FICHES.exists():
        return []
    try:
        data = json.loads(FICHES.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    out, vus = [], set()
    for f in data.get("fiches", []):
        ean = (f or {}).get("ean")
        if isinstance(ean, str) and ean.strip() and ean not in vus:
            vus.add(ean)
            out.append((ean.strip(), f.get("titre")))
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ean", nargs="+", help="chercher ces EAN précis")
    p.add_argument("--limite", type=int, default=0, help="s'arrêter après N EAN (0 = tous)")
    p.add_argument("--langue", default="FR", choices=LANGUES, help="langue de la fiche (défaut FR)")
    p.add_argument("--delai", type=float, default=1.0, help="secondes entre deux appels")
    p.add_argument("--user", default=os.environ.get("ICECAT_USER", ""), help="identifiant Icecat (ou $ICECAT_USER)")
    args = p.parse_args()

    if not args.user:
        print("Il manque votre identifiant Icecat.")
        print()
        print("  L'inscription est gratuite : https://icecat.biz/en/menu/channelpartners")
        print("  Puis :  export ICECAT_USER=votre-identifiant")
        print("          (PowerShell :  $env:ICECAT_USER='votre-identifiant')")
        return 1

    cibles = [(e, None) for e in args.ean] if args.ean else eans_du_releve()
    if not cibles:
        print(f"Aucun EAN à chercher. Lancez d'abord scrape_manomano.py — il remplit {FICHES}.")
        return 1
    if args.limite:
        cibles = cibles[: args.limite]

    print()
    print(f"{len(cibles)} EAN à chercher sur Open Icecat, en {args.langue}.")
    print()

    trouves: dict[str, dict] = {}
    compte = {"trouve": 0, "payant": 0, "absent": 0, "echec": 0}
    methode_qui_marche: str | None = None

    for position, (ean, titre) in enumerate(cibles, start=1):
        etiquette = (titre or "")[:58]
        print(f"[{position}/{len(cibles)}] {ean}  {etiquette}")

        # Une fois qu'une variante a repondu, on s'y tient : inutile de
        # retenter les autres sur chaque produit.
        essais = variantes(ean, args.langue, args.user)
        if methode_qui_marche:
            essais = [v for v in essais if v[0] == methode_qui_marche] + [
                v for v in essais if v[0] != methode_qui_marche
            ]

        statut_final = 0
        for nom, url in essais:
            statut, corps = appelle(url)
            if statut == 200 and corps:
                fiche = extrait_json(corps)
                if fiche is None:
                    # Reponse XML : on garde le brut, l'essentiel est de savoir
                    # que le produit EXISTE.
                    fiche = {"format": "xml", "brut": corps.decode("utf-8", "replace")[:4000]}
                fiche["ean"] = ean
                fiche["via"] = nom
                trouves[ean] = fiche
                methode_qui_marche = nom
                compte["trouve"] += 1
                nb = len(fiche.get("images") or [])
                desc = fiche.get("descriptionLongue") or fiche.get("descriptionCourte") or ""
                print(f"      ✓ trouvé ({nom}) — {nb} image(s), description {len(desc)} car.")
                statut_final = 200
                break
            if statut in (401, 403):
                statut_final = statut
            elif statut == 404 and statut_final == 0:
                statut_final = 404

        if statut_final == 200:
            pass
        elif statut_final in (401, 403):
            compte["payant"] += 1
            print("      · réservé à Full Icecat (offre payante), ou identifiant refusé")
        elif statut_final == 404:
            compte["absent"] += 1
            print("      · absent du catalogue")
        else:
            compte["echec"] += 1
            print("      ✗ aucune variante d'API n'a répondu")

        time.sleep(args.delai)

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps(
            {
                "_source": {
                    "nature": "Fiches produit Open Icecat, retrouvées par EAN.",
                    "licence": (
                        "Open Icecat est distribué sous licence de contenu ouvert et les "
                        "fiches sont approuvées par la marque qui les fournit. Vérifiez "
                        "les conditions en vigueur avant de republier : certains visuels "
                        "haute résolution sont réservés aux revendeurs autorisés."
                    ),
                    "langue": args.langue,
                    "nombre": len(trouves),
                },
                "fiches": list(trouves.values()),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    total = len(cibles)
    print()
    print("  COUVERTURE MESURÉE")
    print(f"    trouvés en Open Icecat   {compte['trouve']:>4} / {total}")
    print(f"    réservés à Full Icecat   {compte['payant']:>4} / {total}")
    print(f"    absents du catalogue     {compte['absent']:>4} / {total}")
    if compte["echec"]:
        print(f"    appels en échec          {compte['echec']:>4} / {total}")
    print()
    print(f"  → {SORTIE}")
    if compte["echec"] == total:
        print()
        print("  Aucune variante d'API n'a répondu. Vérifiez l'identifiant, puis la")
        print("  documentation : https://iceclog.com/manual-for-icecat-json-product-requests/")
        print("  Envoyez-moi la sortie et j'adapte l'appel.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
