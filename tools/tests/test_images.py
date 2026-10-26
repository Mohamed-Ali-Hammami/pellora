#!/usr/bin/env python3
"""
Test de tools/images.py, sans reseau.

    python3 tools/tests/test_images.py

Ce qui est teste : la lecture des dimensions dans l'en-tete des quatre formats,
et l'analyse de la reponse de chaque moteur. Les requetes HTTP sont remplacees
par des reponses enregistrees — c'est le seul moyen de verifier les parseurs
sans dependre de l'etat du jour d'un moteur de recherche.

Ce qui n'est PAS teste, et ne peut pas l'etre ici : que les moteurs repondent
encore la meme chose. Le script le rapporte lui-meme a l'execution, en disant
lequel a repondu et combien d'URL il a rendues.
"""

from __future__ import annotations

import importlib.util
import json
import struct
import sys
import zlib
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("images", RACINE / "tools" / "images.py")
assert spec and spec.loader
img = importlib.util.module_from_spec(spec)
spec.loader.exec_module(img)

echecs: list[str] = []


def verifie(intitule: str, obtenu: object, attendu: object) -> None:
    if obtenu == attendu:
        print(f"  ok   {intitule}")
    else:
        print(f"  ÉCHEC {intitule}\n        obtenu  : {obtenu!r}\n        attendu : {attendu!r}")
        echecs.append(intitule)


# ─────────────────────── dimensions, quatre formats ───────────────────────

def png(largeur: int, hauteur: int) -> bytes:
    def bloc(genre: bytes, donnees: bytes) -> bytes:
        corps = genre + donnees
        return struct.pack(">I", len(donnees)) + corps + struct.pack(">I", zlib.crc32(corps) & 0xFFFFFFFF)

    brut = b"".join(b"\x00" + b"\xff\x00\x00" * largeur for _ in range(hauteur))
    return (
        b"\x89PNG\r\n\x1a\n"
        + bloc(b"IHDR", struct.pack(">IIBBBBB", largeur, hauteur, 8, 2, 0, 0, 0))
        + bloc(b"IDAT", zlib.compress(brut))
        + bloc(b"IEND", b"")
    )


def jpeg(largeur: int, hauteur: int) -> bytes:
    # En-tete minimal : SOI, puis un segment SOF0 qui porte la taille.
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, hauteur, largeur, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + sof + b"\xff\xd9"


def gif(largeur: int, hauteur: int) -> bytes:
    return b"GIF89a" + struct.pack("<HH", largeur, hauteur) + b"\x80\x00\x00"


def webp_vp8x(largeur: int, hauteur: int) -> bytes:
    corps = b"VP8X" + struct.pack("<I", 10) + b"\x00\x00\x00\x00"
    corps += (largeur - 1).to_bytes(3, "little") + (hauteur - 1).to_bytes(3, "little")
    return b"RIFF" + struct.pack("<I", len(corps) + 4) + b"WEBP" + corps


print("\nlecture des dimensions")
verifie("PNG 470×470", img.dimensions(png(470, 470)), (470, 470))
verifie("PNG 120×80", img.dimensions(png(120, 80)), (120, 80))
verifie("JPEG 1600×1200", img.dimensions(jpeg(1600, 1200)), (1600, 1200))
verifie("GIF 64×64", img.dimensions(gif(64, 64)), (64, 64))
verifie("WebP 800×600", img.dimensions(webp_vp8x(800, 600)), (800, 600))
verifie("octets quelconques", img.dimensions(b"pas une image du tout, vraiment pas"), None)

# ──────────────── signatures : ce qui est une image, ce qui ne l'est pas ────────────────

print("\nreconnaissance du type de fichier")
verifie("JPEG reconnu", jpeg(10, 10).startswith(img.SIGNATURES), True)
verifie("PNG reconnu", png(10, 10).startswith(img.SIGNATURES), True)
verifie("WebP reconnu", webp_vp8x(10, 10).startswith(img.SIGNATURES), True)
verifie("GIF reconnu", gif(10, 10).startswith(img.SIGNATURES), True)
verifie("page HTML écartée", b"<!doctype html><html>".startswith(img.SIGNATURES), False)

# ───────────────────── les moteurs, sur reponses enregistrees ─────────────────────

REPONSES: dict[str, str] = {}
img.texte = lambda url, referer=None: REPONSES.get(_quel(url))  # type: ignore[assignment]


def _quel(url: str) -> str:
    if "commons.wikimedia.org" in url:
        return "commons"
    if "duckduckgo.com/i.js" in url:
        return "ddg_json"
    if "duckduckgo.com" in url:
        return "ddg_accueil"
    if "bing.com" in url:
        return "bing"
    if "google.com" in url:
        return "google"
    return "?"


print("\nmoteur commons (API JSON)")
REPONSES["commons"] = json.dumps(
    {
        "query": {
            "pages": {
                "1": {"imageinfo": [{"url": "https://upload.wikimedia.org/a.jpg", "thumburl": "https://x/t.jpg"}]},
                "2": {"imageinfo": [{"thumburl": "https://upload.wikimedia.org/b.jpg"}]},
                "3": {},
            }
        }
    }
)
verifie(
    "URL extraites",
    img.commons("test", 10),
    ["https://upload.wikimedia.org/a.jpg", "https://upload.wikimedia.org/b.jpg"],
)
REPONSES["commons"] = "pas du json"
verifie("réponse illisible → vide", img.commons("test", 10), [])

print("\nmoteur duckduckgo (jeton vqd puis JSON)")
REPONSES["ddg_accueil"] = 'var x = {"foo":1}; vqd="4-123456789";'
REPONSES["ddg_json"] = json.dumps(
    {"results": [{"image": "https://e.test/1.jpg"}, {"image": "https://e.test/2.png"}, {"thumbnail": "x"}]}
)
verifie("URL extraites", img.duckduckgo("test", 10), ["https://e.test/1.jpg", "https://e.test/2.png"])
REPONSES["ddg_accueil"] = "aucun jeton ici"
verifie("sans jeton vqd → vide", img.duckduckgo("test", 10), [])

print("\nmoteur bing (attribut m=\"{...}\" échappé)")
REPONSES["bing"] = (
    '<a class="iusc" m="{&quot;murl&quot;:&quot;https://e.test/grand.jpg&quot;,'
    '&quot;turl&quot;:&quot;https://vignette&quot;}"></a>'
    '<a class="iusc" m="{&quot;murl&quot;:&quot;https://e.test/autre.webp&quot;}"></a>'
    '<a class="iusc" m="{&quot;turl&quot;:&quot;sans-murl&quot;}"></a>'
)
verifie("murl extraits", img.bing("test", 1), ["https://e.test/grand.jpg", "https://e.test/autre.webp"])

print("\nmoteur google (trois formes)")
REPONSES["google"] = '{"ou":"https://e.test/ancien.jpg","ow":1200}'
verifie("forme ancienne \"ou\"", img.google("test", 10), ["https://e.test/ancien.jpg"])
REPONSES["google"] = '["https://e.test/triplet.jpg",1600,1200],["https://e.test/deux.webp",800,600]'
verifie(
    "forme triplet",
    img.google("test", 10),
    ["https://e.test/triplet.jpg", "https://e.test/deux.webp"],
)
REPONSES["google"] = 'rien de structuré, juste https://ailleurs.test/photo.jpg et https://www.gstatic.com/x.png'
verifie("repli, domaines Google écartés", img.google("test", 10), ["https://ailleurs.test/photo.jpg"])

print("\nenchaînement automatique des moteurs")
REPONSES.update({"commons": "{}", "ddg_accueil": "rien", "bing": "", "google": '{"ou":"https://e.test/g.jpg"}'})
verifie("passe au moteur suivant", img.cherche("test", "auto", 5), ("google", ["https://e.test/g.jpg"]))
REPONSES["bing"] = '<a m="{&quot;murl&quot;:&quot;https://e.test/b.jpg&quot;}"></a>'
verifie("s'arrête au premier qui répond", img.cherche("test", "auto", 5), ("bing", ["https://e.test/b.jpg"]))
REPONSES.update({"bing": "", "google": ""})
verifie("aucun moteur ne répond", img.cherche("test", "auto", 5), ("aucun", []))

print()
if echecs:
    print(f"{len(echecs)} échec(s) : {', '.join(echecs)}")
    sys.exit(1)
print("tout passe.")
