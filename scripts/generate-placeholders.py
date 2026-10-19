#!/usr/bin/env python3
"""
Génère les illustrations vectorielles de substitution.

Pourquoi un générateur plutôt que seize fichiers écrits à la main : la
cohérence graphique. Les seize visuels partagent la même palette, les mêmes
dégradés et la même construction, ce qui les fait lire comme une famille
plutôt que comme un assemblage. Et quand la palette change, un seul endroit
change.

Ces visuels NE SONT PAS des photographies de produits. Les fiches affichent
la mention correspondante, et `product-media.ts` les remplace automatiquement
dès que de vraies photos sont déposées.

Usage : python3 scripts/generate-placeholders.py
"""

from pathlib import Path

OUT = Path("public/img/placeholder")

INK = "#17120f"
BODY_TOP = "#302825"
BODY_BOTTOM = "#1b1512"
STEEL = "#4a403b"
BRASS = "#a9844f"
SAND = "#f2ebe2"
CREAM = "#fbf8f4"
EMBER = "#bc4213"
FLAME = "#e9762a"
GLOW = "#ffc879"


def defs(uid: str, glass_cx: str = "50%", glass_cy: str = "58%") -> str:
    """Dégradés partagés. Les identifiants sont suffixés : plusieurs SVG
    peuvent coexister dans une même page sans que leurs defs se télescopent."""
    return f"""  <defs>
    <linearGradient id="body{uid}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="{BODY_TOP}"/>
      <stop offset="1" stop-color="{BODY_BOTTOM}"/>
    </linearGradient>
    <linearGradient id="sheen{uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glass{uid}" cx="{glass_cx}" cy="{glass_cy}" r="68%">
      <stop offset="0" stop-color="{GLOW}"/>
      <stop offset="0.34" stop-color="{FLAME}"/>
      <stop offset="0.68" stop-color="{EMBER}"/>
      <stop offset="1" stop-color="#3a1d0d"/>
    </radialGradient>
    <radialGradient id="halo{uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="{FLAME}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="{FLAME}" stop-opacity="0"/>
    </radialGradient>
  </defs>
"""


def flame(cx: float, cy: float, scale: float, uid: str) -> str:
    """
    Flamme stylisée, posée sur le brasier.

    Le contour est volontairement ASYMÉTRIQUE, avec un décroché sur la droite.
    Une larme symétrique — le réflexe quand on dessine une flamme — se lit
    comme une goutte d'eau, ce qui est exactement le contresens à éviter sur
    une boutique de chauffage.
    """
    s = scale
    return f"""  <g transform="translate({cx} {cy}) scale({s})">
    <path d="M0 26 C -14 26 -19 17 -19 7 C -19 -4 -11 -12 -6 -32
             C -2 -24 3 -21 5 -14 C 9 -20 16 -14 17 -2
             C 18 14 11 26 0 26 Z"
          fill="{GLOW}" opacity="0.94"/>
    <path d="M0 19 C -8 19 -11 13 -11 6 C -11 -2 -5 -8 -1 -18
             C 2 -10 10 -4 10 5 C 10 13 6 19 0 19 Z"
          fill="#fff6e0" opacity="0.88"/>
  </g>
"""


def stove(
    name: str,
    *,
    width: int = 400,
    height: int = 500,
    body_w: int = 210,
    body_h: int = 330,
    outlets: int = 0,
    hydro: bool = False,
    dhw: bool = False,
    detail: bool = False,
) -> None:
    """Un poêle vu de face. Les variantes se distinguent par la silhouette et
    par les accessoires visibles (sorties canalisables, piquages hydrauliques)
    — c'est ce qui permet de reconnaître la famille sur une vignette."""
    uid = "".join(ch for ch in name if ch.isalnum())
    cx = width / 2
    body_x = cx - body_w / 2
    body_y = height - body_h - 70

    glass_w = body_w * (0.78 if not detail else 0.86)
    glass_h = body_h * (0.42 if not detail else 0.58)
    glass_x = cx - glass_w / 2
    glass_y = body_y + body_h * (0.26 if not detail else 0.18)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img" aria-hidden="true">',
        defs(uid),
        # Lueur projetée au sol : ancre l'objet, évite l'effet « découpé ».
        f'  <ellipse cx="{cx}" cy="{height - 46}" rx="{body_w * 0.78:.0f}" ry="26" fill="url(#halo{uid})"/>',
    ]

    # Conduit de fumées.
    parts.append(
        f'  <rect x="{cx - 13:.0f}" y="18" width="26" height="{body_y - 14:.0f}" rx="5" fill="{STEEL}"/>'
        f'<rect x="{cx - 13:.0f}" y="18" width="9" height="{body_y - 14:.0f}" fill="url(#sheen{uid})"/>'
    )

    # Sorties canalisables : deux gaines qui partent vers l'arrière.
    for i in range(outlets):
        side = -1 if i == 0 else 1
        x = cx + side * (body_w / 2 + 16)
        parts.append(
            f'  <path d="M{cx + side * body_w / 2:.0f} {body_y + 46} '
            f'H{x + side * 20:.0f} V{body_y - 2} " fill="none" stroke="{STEEL}" '
            f'stroke-width="15" stroke-linecap="round"/>'
        )

    # Piquages hydrauliques : départ et retour d'eau.
    if hydro:
        for offset, color in ((28, EMBER), (56, "#3d6ea8")):
            parts.append(
                f'  <rect x="{body_x - 30:.0f}" y="{body_y + body_h - offset - 10:.0f}" '
                f'width="34" height="11" rx="5" fill="{STEEL}"/>'
                f'<circle cx="{body_x - 30:.0f}" cy="{body_y + body_h - offset - 4:.0f}" r="7" fill="{color}"/>'
            )
    if dhw:
        parts.append(
            f'  <rect x="{body_x + body_w - 4:.0f}" y="{body_y + body_h - 74:.0f}" '
            f'width="36" height="11" rx="5" fill="{STEEL}"/>'
            f'<circle cx="{body_x + body_w + 32:.0f}" cy="{body_y + body_h - 68:.0f}" r="7" fill="#3d6ea8"/>'
        )

    # Corps.
    parts.append(
        f'  <rect x="{body_x:.0f}" y="{body_y:.0f}" width="{body_w}" height="{body_h}" rx="18" fill="url(#body{uid})"/>'
        f'<rect x="{body_x:.0f}" y="{body_y:.0f}" width="{body_w}" height="{body_h}" rx="18" fill="url(#sheen{uid})"/>'
    )
    # Dessus (plaque de cuisson / trappe de remplissage).
    parts.append(
        f'  <rect x="{body_x + 8:.0f}" y="{body_y + 6:.0f}" width="{body_w - 16}" height="12" rx="6" fill="{STEEL}" opacity="0.75"/>'
    )

    # Vitre.
    parts.append(
        f'  <rect x="{glass_x:.0f}" y="{glass_y:.0f}" width="{glass_w:.0f}" height="{glass_h:.0f}" '
        f'rx="10" fill="url(#glass{uid})"/>'
        f'<rect x="{glass_x:.0f}" y="{glass_y:.0f}" width="{glass_w:.0f}" height="{glass_h:.0f}" '
        f'rx="10" fill="none" stroke="{INK}" stroke-width="3" opacity="0.55"/>'
    )
    parts.append(flame(cx, glass_y + glass_h * 0.66, glass_h / 110, uid))

    # Brasier : la ligne sombre au bas de la vitre.
    parts.append(
        f'  <rect x="{glass_x + 14:.0f}" y="{glass_y + glass_h - 16:.0f}" '
        f'width="{glass_w - 28:.0f}" height="11" rx="4" fill="{INK}" opacity="0.65"/>'
    )

    # Bandeau de commande.
    panel_y = glass_y + glass_h + 20
    parts.append(
        f'  <rect x="{cx - 44:.0f}" y="{panel_y:.0f}" width="88" height="22" rx="7" fill="{INK}" opacity="0.55"/>'
    )
    for i in range(3):
        parts.append(
            f'  <circle cx="{cx - 26 + i * 26:.0f}" cy="{panel_y + 11:.0f}" r="4" '
            f'fill="{BRASS if i == 1 else CREAM}" opacity="{0.9 if i == 1 else 0.45}"/>'
        )

    # Filet laiton : la seule touche « finition soignée » du dessin.
    parts.append(
        f'  <rect x="{body_x + 14:.0f}" y="{body_y + body_h - 30:.0f}" width="{body_w - 28}" height="2" '
        f'rx="1" fill="{BRASS}" opacity="0.5"/>'
    )

    # Pieds.
    for side in (-1, 1):
        parts.append(
            f'  <rect x="{cx + side * (body_w / 2 - 34) - 9:.0f}" y="{body_y + body_h - 2:.0f}" '
            f'width="18" height="26" rx="6" fill="{STEEL}"/>'
        )

    parts.append("</svg>")
    (OUT / f"{name}.svg").write_text("\n".join(parts) + "\n", encoding="utf-8")


def hero() -> None:
    """Visuel du bandeau d'accueil : même poêle, mis en scène sur fond sombre."""
    w, h, uid = 520, 620, "hero"
    cx = w / 2
    body_w, body_h = 260, 400
    body_x, body_y = cx - body_w / 2, h - body_h - 90
    glass_w, glass_h = body_w * 0.8, body_h * 0.44
    glass_x, glass_y = cx - glass_w / 2, body_y + body_h * 0.24

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-hidden="true">',
        defs(uid),
        f'  <ellipse cx="{cx}" cy="{h - 56}" rx="210" ry="40" fill="url(#halo{uid})"/>',
        # Mur suggéré derrière l'appareil : donne la profondeur sans photo.
        f'  <rect x="{cx - 180:.0f}" y="40" width="360" height="{h - 130}" rx="22" fill="#ffffff" opacity="0.025"/>',
        f'  <rect x="{cx - 16:.0f}" y="24" width="32" height="{body_y - 18:.0f}" rx="6" fill="{STEEL}"/>',
        f'  <rect x="{cx - 16:.0f}" y="24" width="11" height="{body_y - 18:.0f}" fill="url(#sheen{uid})"/>',
        f'  <rect x="{body_x:.0f}" y="{body_y:.0f}" width="{body_w}" height="{body_h}" rx="22" fill="url(#body{uid})"/>',
        f'  <rect x="{body_x:.0f}" y="{body_y:.0f}" width="{body_w}" height="{body_h}" rx="22" fill="url(#sheen{uid})"/>',
        f'  <rect x="{body_x + 10:.0f}" y="{body_y + 8:.0f}" width="{body_w - 20}" height="14" rx="7" fill="{STEEL}" opacity="0.8"/>',
        f'  <rect x="{glass_x:.0f}" y="{glass_y:.0f}" width="{glass_w:.0f}" height="{glass_h:.0f}" rx="12" fill="url(#glass{uid})"/>',
        f'  <rect x="{glass_x:.0f}" y="{glass_y:.0f}" width="{glass_w:.0f}" height="{glass_h:.0f}" rx="12" fill="none" stroke="{INK}" stroke-width="4" opacity="0.5"/>',
        flame(cx, glass_y + glass_h * 0.64, glass_h / 95, uid),
        f'  <rect x="{glass_x + 18:.0f}" y="{glass_y + glass_h - 20:.0f}" width="{glass_w - 36:.0f}" height="13" rx="5" fill="{INK}" opacity="0.7"/>',
        f'  <rect x="{cx - 52:.0f}" y="{glass_y + glass_h + 26:.0f}" width="104" height="26" rx="8" fill="{INK}" opacity="0.5"/>',
    ]
    for i in range(3):
        svg.append(
            f'  <circle cx="{cx - 30 + i * 30:.0f}" cy="{glass_y + glass_h + 39:.0f}" r="5" '
            f'fill="{BRASS if i == 1 else CREAM}" opacity="{0.95 if i == 1 else 0.4}"/>'
        )
    svg.append(
        f'  <rect x="{body_x + 18:.0f}" y="{body_y + body_h - 36:.0f}" width="{body_w - 36}" height="2.5" rx="1" fill="{BRASS}" opacity="0.55"/>'
    )
    for side in (-1, 1):
        svg.append(
            f'  <rect x="{cx + side * (body_w / 2 - 40) - 11:.0f}" y="{body_y + body_h - 2:.0f}" width="22" height="32" rx="7" fill="{STEEL}"/>'
        )
    svg.append("</svg>")
    (OUT / "hero-stove.svg").write_text("\n".join(svg) + "\n", encoding="utf-8")


def family_icon(name: str, hydro: bool) -> None:
    """Pictogramme de famille : un poêle avec, à droite, ce qu'il alimente —
    de l'air soufflé ou un radiateur."""
    uid = name.replace("-", "")
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-hidden="true">',
        defs(uid),
        f'  <rect x="10" y="20" width="40" height="62" rx="8" fill="url(#body{uid})"/>',
        f'  <rect x="10" y="20" width="14" height="62" rx="8" fill="url(#sheen{uid})"/>',
        f'  <rect x="26" y="8" width="8" height="14" rx="3" fill="{STEEL}"/>',
        f'  <rect x="17" y="33" width="26" height="28" rx="5" fill="url(#glass{uid})"/>',
        f'  <rect x="17" y="33" width="26" height="28" rx="5" fill="none" stroke="{INK}" stroke-width="2" opacity="0.5"/>',
        f'  <rect x="20" y="54" width="20" height="5" rx="2" fill="{INK}" opacity="0.6"/>',
        f'  <rect x="20" y="68" width="20" height="7" rx="3" fill="{INK}" opacity="0.45"/>',
    ]
    if hydro:
        # Radiateur : ce que le poêle hydro alimente.
        svg.append(f'  <rect x="60" y="34" width="28" height="34" rx="4" fill="{STEEL}" opacity="0.9"/>')
        for i in range(4):
            svg.append(f'  <rect x="{63 + i * 6}" y="38" width="3" height="26" rx="1.5" fill="{CREAM}" opacity="0.55"/>')
        svg.append(f'  <path d="M50 58 H60" stroke="{EMBER}" stroke-width="4" stroke-linecap="round"/>')
        svg.append(f'  <path d="M50 66 H60" stroke="#3d6ea8" stroke-width="4" stroke-linecap="round"/>')
    else:
        # Trois traits d'air soufflé.
        for i, (y, length) in enumerate(((38, 26), (48, 32), (58, 22))):
            svg.append(
                f'  <path d="M56 {y} h{length}" stroke="{FLAME}" stroke-width="4" stroke-linecap="round" opacity="{0.9 - i * 0.2:.1f}"/>'
            )
    svg.append("</svg>")
    (OUT / f"{name}.svg").write_text("\n".join(svg) + "\n", encoding="utf-8")


def accessory(name: str, kind: str) -> None:
    """Accessoires : conduit, thermostat, aspirateur, palette de granulés."""
    uid = kind
    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-hidden="true">',
        defs(uid),
        f'  <ellipse cx="200" cy="356" rx="130" ry="22" fill="{INK}" opacity="0.06"/>',
    ]

    if kind == "flue":
        # Trois tronçons de conduit et un té de purge.
        for i, x in enumerate((112, 176, 240)):
            svg.append(
                f'  <rect x="{x}" y="{70 + i * 8}" width="48" height="{250 - i * 16}" rx="14" fill="{STEEL}"/>'
                f'<rect x="{x}" y="{70 + i * 8}" width="16" height="{250 - i * 16}" rx="14" fill="url(#sheen{uid})"/>'
                f'<ellipse cx="{x + 24}" cy="{70 + i * 8}" rx="24" ry="9" fill="#5d514a"/>'
            )
        svg.append(f'  <rect x="96" y="238" width="80" height="26" rx="12" fill="#5d514a"/>')
        svg.append(f'  <rect x="150" y="150" width="58" height="12" rx="6" fill="{BRASS}" opacity="0.6"/>')

    elif kind == "thermostat":
        svg.append(f'  <rect x="112" y="96" width="176" height="200" rx="22" fill="{CREAM}" stroke="{INK}" stroke-opacity="0.12" stroke-width="3"/>')
        svg.append(f'  <rect x="140" y="130" width="120" height="76" rx="12" fill="{INK}" opacity="0.9"/>')
        svg.append(f'  <text x="200" y="182" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="700" fill="{GLOW}">21°</text>')
        svg.append(f'  <circle cx="200" cy="248" r="30" fill="none" stroke="{INK}" stroke-opacity="0.2" stroke-width="6"/>')
        svg.append(f'  <circle cx="200" cy="248" r="30" fill="none" stroke="{EMBER}" stroke-width="6" stroke-linecap="round" stroke-dasharray="140 50" transform="rotate(-120 200 248)"/>')
        svg.append(f'  <circle cx="200" cy="248" r="9" fill="{EMBER}"/>')

    elif kind == "vacuum":
        svg.append(f'  <rect x="118" y="140" width="164" height="176" rx="26" fill="{STEEL}"/>')
        svg.append(f'  <rect x="118" y="140" width="52" height="176" rx="26" fill="url(#sheen{uid})"/>')
        svg.append(f'  <rect x="132" y="98" width="136" height="54" rx="20" fill="#5d514a"/>')
        svg.append(f'  <circle cx="200" cy="124" r="17" fill="{INK}" opacity="0.55"/>')
        svg.append(f'  <rect x="146" y="214" width="108" height="10" rx="5" fill="{BRASS}" opacity="0.5"/>')
        # Flexible métallique.
        svg.append(f'  <path d="M282 170 C 332 182 340 244 306 288" fill="none" stroke="#5d514a" stroke-width="18" stroke-linecap="round"/>')
        svg.append(f'  <path d="M282 170 C 332 182 340 244 306 288" fill="none" stroke="{CREAM}" stroke-width="4" stroke-linecap="round" opacity="0.25" stroke-dasharray="7 12"/>')

    else:  # pellets
        # Palette filmée : trois rangs de sacs.
        for row in range(3):
            y = 252 - row * 56
            for col in range(3):
                x = 96 + col * 72
                svg.append(
                    f'  <rect x="{x}" y="{y}" width="64" height="50" rx="9" fill="#b8a07c" opacity="{0.95 - row * 0.07:.2f}"/>'
                    f'<rect x="{x + 10}" y="{y + 16}" width="44" height="7" rx="3.5" fill="{INK}" opacity="0.28"/>'
                )
        svg.append(f'  <rect x="84" y="302" width="232" height="20" rx="5" fill="#8a7257"/>')
        for i in range(4):
            svg.append(f'  <rect x="{96 + i * 60}" y="322" width="26" height="16" rx="4" fill="#6f5c45"/>')
        svg.append(f'  <rect x="88" y="136" width="224" height="170" rx="10" fill="{CREAM}" opacity="0.14"/>')

    svg.append("</svg>")
    (OUT / f"{name}.svg").write_text("\n".join(svg) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    hero()
    family_icon("family-air", hydro=False)
    family_icon("family-hydro", hydro=True)

    # Poêles à air ventilé.
    stove("stove-air")
    stove("stove-air-detail", detail=True, body_w=250, body_h=300)
    stove("stove-air-ducted", outlets=2, body_w=220, body_h=345)
    stove("stove-air-slim", body_w=150, body_h=360)
    stove("stove-air-large", body_w=250, body_h=360)

    # Poêles hydro.
    stove("stove-hydro", hydro=True, body_w=220, body_h=340)
    stove("stove-hydro-large", hydro=True, body_w=235, body_h=350)
    stove("stove-hydro-dhw", hydro=True, dhw=True, body_w=240, body_h=360)
    stove("stove-hydro-xl", hydro=True, dhw=True, body_w=255, body_h=375)

    # Accessoires.
    accessory("flue-kit", "flue")
    accessory("thermostat", "thermostat")
    accessory("ash-vacuum", "vacuum")
    accessory("pellets", "pellets")

    files = sorted(OUT.glob("*.svg"))
    print(f"[placeholders] {len(files)} illustration(s) générée(s) dans {OUT}/")
    for file in files:
        print(f"[placeholders]   {file.name} ({file.stat().st_size} o)")


if __name__ == "__main__":
    main()
