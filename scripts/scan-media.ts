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
 * Résolution minimale acceptée pour une photo produit.
 *
 * La fiche produit affiche le visuel principal autour de 1 000 px de large.
 * En dessous de 600 px, l'image est visiblement floue, et une vignette de
 * catalogue fournisseur (souvent 125 px) ruine la page sans rien signaler.
 * Le script refuse donc de les référencer : mieux vaut une illustration
 * assumée qu'une photo pixelisée.
 */
const MIN_PIXELS = 600;

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

const knownIds = new Set(products.map((p) => p.id));
const entries: Record<string, string[]> = {};
const unknownFolders: string[] = [];
const tooSmall: string[] = [];

if (existsSync(ROOT)) {
  for (const folder of readdirSync(ROOT, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;

    if (!knownIds.has(folder.name)) {
      unknownFolders.push(folder.name);
      continue;
    }

    const files = readdirSync(join(ROOT, folder.name))
      .filter((file) => ACCEPTED.test(file))
      .sort((a, b) => a.localeCompare(b, 'en'));

    const usable: string[] = [];
    for (const file of files) {
      const size = imageSize(join(ROOT, folder.name, file));
      if (size && Math.min(size.width, size.height) < MIN_PIXELS) {
        tooSmall.push(`${folder.name}/${file} (${size.width}×${size.height})`);
        continue;
      }
      usable.push(`/img/products/${folder.name}/${file}`);
    }

    if (usable.length > 0) {
      entries[folder.name] = usable;
    }
  }
}

const body = Object.keys(entries).length === 0
  ? '{}'
  : `{\n${Object.entries(entries)
      .map(([id, files]) => `  '${id}': [\n${files.map((f) => `    '${f}',`).join('\n')}\n  ],`)
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
 */

export const generatedMedia: Record<string, readonly string[]> = ${body};
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
for (const file of tooSmall) {
  console.warn(
    `[media] ÉCARTÉ : ${file} — moins de ${MIN_PIXELS} px de côté. ` +
      `Une vignette de catalogue fournisseur s'affiche floue sur la fiche : demandez le fichier d'origine.`,
  );
}
const missing = [...knownIds].filter((id) => !entries[id]);
if (missing.length > 0) {
  console.log(`[media] encore en illustration : ${missing.join(', ')}`);
}
