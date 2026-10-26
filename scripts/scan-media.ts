/**
 * Génère `src/lib/product-media.generated.ts` à partir des fichiers réellement
 * présents dans `public/img/products/<id-produit>/`.
 *
 * Usage : npm run media:scan
 *
 * À lancer après chaque livraison de visuels. Le script vérifie au passage
 * que chaque dossier correspond bien à un produit du catalogue : un dossier
 * mal nommé ne serait jamais affiché, et l'erreur est difficile à voir.
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { products } from '../src/lib/catalog';

const ACCEPTED = /\.(jpe?g|png|webp|avif|svg)$/i;

/**
 * Résolution en dessous de laquelle on PRÉVIENT, sans rien refuser.
 *
 * Ce seuil écartait les fichiers trop petits. Il ne le fait plus : toutes les
 * tailles sont acceptées, et c'est l'AFFICHAGE qui s'adapte.
 *
 * Ce qui a changé, et pourquoi c'est mieux : le script mesure désormais chaque
 * fichier et inscrit sa résolution dans `product-media.generated.ts`. Le
 * composant d'affichage borne la taille de rendu à cette résolution, donc une
 * image de 470 px n'est plus étirée à 1 000 px — elle s'affiche nette, à sa
 * taille, centrée dans son cadre. Refuser le fichier n'avait de sens que
 * lorsque l'affichage l'agrandissait de force.
 *
 * Le seuil reste utile pour un avertissement : une vignette de 125 px occupera
 * un huitième du cadre, ce qu'on préfère savoir avant de mettre en ligne.
 */
const SMALL_PIXELS = 600;

/**
 * Dimensions d'une image, lues dans son en-tête.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : trois formats à couvrir,
 * quelques octets à lire, et aucune dépendance supplémentaire pour un script
 * qui ne tourne qu'à la main. Les SVG, vectoriels, n'ont pas de résolution et
 * sont acceptés d'office.
 */
function imageSize(file: string): { width: number; height: number } | null {
  if (/\.svg$/i.test(file)) return null;
  const buffer = readFileSync(file);

  // PNG : largeur et hauteur en big-endian à l'offset 16.
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // WebP (VP8 simple, VP8L sans perte, VP8X étendu).
  if (buffer.length > 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buffer.toString('ascii', 12, 16);
    if (kind === 'VP8 ') {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (kind === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      const read24 = (offset: number) =>
        buffer[offset]! | (buffer[offset + 1]! << 8) | (buffer[offset + 2]! << 16);
      return { width: read24(24) + 1, height: read24(27) + 1 };
    }
  }

  // JPEG : on parcourt les segments jusqu'au marqueur de cadre (SOFn).
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1]!;
      // SOF0 à SOF15, hors marqueurs qui ne décrivent pas de cadre.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  return null;
}
const ROOT = join(process.cwd(), 'public', 'img', 'products');
const OUTPUT = join(process.cwd(), 'src', 'lib', 'product-media.generated.ts');

interface Visuel {
  src: string;
  width: number | null;
  height: number | null;
}

const knownIds = new Set(products.map((p) => p.id));
const entries: Record<string, Visuel[]> = {};
const unknownFolders: string[] = [];
const petites: string[] = [];

if (existsSync(ROOT)) {
  for (const folder of readdirSync(ROOT, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;

    if (!knownIds.has(folder.name)) {
      unknownFolders.push(folder.name);
      continue;
    }

    // Un fichier préfixé d'un souligné est mis de côté, pas publié. Sert aux
    // documents qu'on veut garder auprès de leur produit sans qu'ils entrent
    // dans la galerie : typiquement une étiquette énergétique reçue avant les
    // photographies, qui deviendrait sinon la vignette du produit dans toutes
    // les grilles. Le jour où les photos arrivent, il suffit de retirer le
    // souligné et de relancer ce script.
    const files = readdirSync(join(ROOT, folder.name))
      .filter((file) => ACCEPTED.test(file) && !file.startsWith('_'))
      .sort((a, b) => a.localeCompare(b, 'en'));

    const usable: Visuel[] = [];
    for (const file of files) {
      const size = imageSize(join(ROOT, folder.name, file));
      if (size && Math.min(size.width, size.height) < SMALL_PIXELS) {
        petites.push(`${folder.name}/${file} (${size.width}×${size.height})`);
      }
      usable.push({
        src: `/img/products/${folder.name}/${file}`,
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
    }

    if (usable.length > 0) {
      entries[folder.name] = usable;
    }
  }
}

function ligne(v: Visuel): string {
  const taille = v.width === null || v.height === null
    ? 'width: null, height: null'
    : `width: ${v.width}, height: ${v.height}`;
  return `    { src: '${v.src}', ${taille} },`;
}

const body = Object.keys(entries).length === 0
  ? '{}'
  : `{\n${Object.entries(entries)
      .map(([id, files]) => `  '${id}': [\n${files.map(ligne).join('\n')}\n  ],`)
      .join('\n')}\n}`;

writeFileSync(
  OUTPUT,
  `/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 *
 * Produit par \`npm run media:scan\`, qui liste les photos réellement déposées
 * dans \`public/img/products/<id-produit>/\`. Tant qu'un produit n'a pas de
 * dossier, le site affiche l'illustration de substitution déclarée dans le
 * catalogue.
 *
 * La résolution de chaque fichier est mesurée et inscrite ici : c'est elle qui
 * borne la taille d'affichage, pour qu'une petite image reste nette au lieu
 * d'être étirée. \`null\` pour un SVG, qui n'a pas de résolution.
 */

export interface GeneratedImage {
  readonly src: string;
  readonly width: number | null;
  readonly height: number | null;
}

export const generatedMedia: Record<string, readonly GeneratedImage[]> = ${body};
`,
  'utf8',
);

const covered = Object.keys(entries).length;
console.log(`[media] ${covered} produit(s) avec photos réelles sur ${knownIds.size}.`);
for (const [id, files] of Object.entries(entries)) {
  console.log(`[media]   ${id} : ${files.length} visuel(s)`);
}
for (const folder of unknownFolders) {
  console.warn(
    `[media] AVERTISSEMENT : le dossier « ${folder} » ne correspond à aucun id du catalogue — ses visuels ne seront jamais affichés.`,
  );
}
for (const file of petites) {
  console.warn(
    `[media] PETITE : ${file} — moins de ${SMALL_PIXELS} px de côté. ` +
      `Elle est référencée et s'affichera nette, mais à sa taille : elle n'occupera ` +
      `qu'une partie du cadre. Le fichier d'origine du fournisseur remplirait la fiche.`,
  );
}
const missing = [...knownIds].filter((id) => !entries[id]);
if (missing.length > 0) {
  console.log(`[media] encore en illustration : ${missing.join(', ')}`);
}
