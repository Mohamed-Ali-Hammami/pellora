/**
 * Télécharge les visuels relevés et les dépose là où `media:scan` les attend.
 *
 * Usage : npm run media:fetch          (les 12 fiches du catalogue)
 *         npm run media:fetch -- --all (les 86 références du relevé)
 *
 * POURQUOI CE SCRIPT EXISTE, ET CE QU'IL NE RÈGLE PAS.
 *
 * Les URL viennent de `data/releves/*.json`, champ `imageSource`. Ce sont les
 * visuels du CDN de ManoMano, et ils APPARTIENNENT AUX VENDEURS de la place de
 * marché — pas à nous. Les télécharger pour travailler est une chose ; les
 * publier sur la boutique en est une autre, et celle-là demande l'accord écrit
 * du titulaire des droits (fabricant ou vendeur). Le script le rappelle à
 * chaque exécution parce qu'une facture rétroactive d'agence photo dépasse de
 * loin le prix d'un visuel acheté.
 *
 * Ce que le script fait, concrètement :
 *   1. essaie la variante « large » du CDN avant « medium » : `media:scan`
 *      refuse toute image de moins de 600 px, et les vignettes de liste sont
 *      souvent en dessous ;
 *   2. écrit dans `public/img/products/<id-produit>/01.jpg` ;
 *   3. annonce la résolution obtenue, pour qu'on sache avant de lancer
 *      `media:scan` lesquelles passeront le seuil.
 *
 * Il ne modifie NI le catalogue, NI `product-media.generated.ts`. Après lui :
 * `npm run media:scan`.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

const RELEVES = 'data/releves';
const OUT = 'public/img/products';

/** Résolution minimale acceptée par `media:scan`. Dupliquée ici à dessein : */
/* ce script doit pouvoir prévenir AVANT, pas constater après. */
const MIN_PIXELS = 600;

interface Reference {
  nom?: string;
  url?: string;
  imageSource?: string;
  retenu_catalogue?: string;
}

/** Dimensions d'une image JPEG ou PNG, lues dans son en-tête. */
function dimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG : la taille est à offset fixe dans le chunk IHDR.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG : il faut parcourir les segments jusqu'à un marqueur SOF.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1] ?? 0;
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 portent la taille.
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      const length = buf.readUInt16BE(i + 2);
      if (length < 2) return null;
      i += 2 + length;
    }
  }
  return null;
}

/**
 * Essaie la variante la plus grande d'abord.
 *
 * Le CDN sert la même image sous plusieurs tailles, désignées par un segment
 * du chemin. On ne sait pas lesquelles existent pour un visuel donné, donc on
 * les demande dans l'ordre et on garde la première qui répond.
 */
function variantes(url: string): string[] {
  const tailles = ['original', 'large', 'medium'];
  const vues = new Set<string>();
  const out: string[] = [];
  for (const taille of tailles) {
    const candidat = url.replace(/\/images\/[a-z]+\//, `/images/${taille}/`);
    if (!vues.has(candidat)) {
      vues.add(candidat);
      out.push(candidat);
    }
  }
  if (!vues.has(url)) out.push(url);
  return out;
}

async function telecharge(url: string): Promise<Buffer | null> {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    return Buffer.from(await reponse.arrayBuffer());
  } catch {
    return null;
  }
}

function references(): Reference[] {
  if (!existsSync(RELEVES)) return [];
  const out: Reference[] = [];
  for (const nom of readdirSync(RELEVES).filter((f) => f.endsWith('.json'))) {
    const data: unknown = JSON.parse(readFileSync(join(RELEVES, nom), 'utf8'));
    if (typeof data !== 'object' || data === null) continue;
    for (const [cle, valeur] of Object.entries(data)) {
      if (cle.startsWith('_') || !Array.isArray(valeur)) continue;
      out.push(...(valeur as Reference[]));
    }
  }
  return out;
}

/** Identifiant de dossier : l'id produit s'il existe, sinon la référence ManoMano. */
function dossier(ref: Reference): string | null {
  if (ref.retenu_catalogue) return ref.retenu_catalogue;
  const m = /-(\d+)$/.exec(ref.url ?? '');
  return m?.[1] ? `releve-${m[1]}` : null;
}

async function main(): Promise<void> {
  const tout = process.argv.includes('--all');

  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────────────┐');
  console.log('  │ DROITS D’AUTEUR — à lire avant de publier ces visuels         │');
  console.log('  │                                                              │');
  console.log('  │ Ces images appartiennent aux vendeurs de la place de marché.  │');
  console.log('  │ Les télécharger pour travailler est une chose ; les publier   │');
  console.log('  │ sur la boutique demande l’accord écrit du titulaire des       │');
  console.log('  │ droits — fabricant ou vendeur. Sans cet accord, une facture   │');
  console.log('  │ rétroactive est un risque réel, et elle dépasse largement le  │');
  console.log('  │ prix d’un visuel acheté ou d’une photo faite soi-même.        │');
  console.log('  └──────────────────────────────────────────────────────────────┘');
  console.log('');

  const refs = references().filter((r) => {
    if (!r.imageSource) return false;
    return tout || Boolean(r.retenu_catalogue);
  });

  if (refs.length === 0) {
    console.error('Aucune référence avec un champ « imageSource » dans data/releves/.');
    process.exit(1);
  }

  console.log(`${refs.length} visuel(s) à récupérer.${tout ? '' : ' (--all pour tout le relevé)'}`);
  console.log('');

  let ok = 0;
  let trop_petites = 0;
  let echecs = 0;

  for (const ref of refs) {
    const id = dossier(ref);
    if (!id || !ref.imageSource) continue;

    let image: Buffer | null = null;
    let source = '';
    for (const candidat of variantes(ref.imageSource)) {
      image = await telecharge(candidat);
      if (image) {
        source = candidat;
        break;
      }
    }

    if (!image) {
      console.error(`  ✗ ${id} — téléchargement impossible`);
      echecs += 1;
      continue;
    }

    const dim = dimensions(image);
    const taille = dim ? `${dim.width}×${dim.height}` : 'taille inconnue';
    const suffisante = dim !== null && dim.width >= MIN_PIXELS && dim.height >= MIN_PIXELS;

    const cible = join(OUT, id);
    mkdirSync(cible, { recursive: true });
    writeFileSync(join(cible, '01.jpg'), image);

    if (suffisante) {
      console.log(`  ✓ ${id} — ${taille}`);
      ok += 1;
    } else {
      console.log(`  ⚠ ${id} — ${taille} : sous le seuil de ${MIN_PIXELS} px, media:scan la refusera`);
      trop_petites += 1;
    }
    void source;
  }

  console.log('');
  console.log(`${ok} image(s) exploitable(s), ${trop_petites} trop petite(s), ${echecs} échec(s).`);
  if (ok > 0) {
    console.log('');
    console.log('Étape suivante : npm run media:scan');
  }
  if (trop_petites > 0) {
    console.log('');
    console.log('Les images trop petites restent sur le disque mais ne seront pas');
    console.log('référencées : une vignette pixelisée est pire qu’une illustration.');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
