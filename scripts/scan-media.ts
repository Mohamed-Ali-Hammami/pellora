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

import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { products } from '../src/lib/catalog';

const ACCEPTED = /\.(jpe?g|png|webp|avif|svg)$/i;
const ROOT = join(process.cwd(), 'public', 'img', 'products');
const OUTPUT = join(process.cwd(), 'src', 'lib', 'product-media.generated.ts');

const knownIds = new Set(products.map((p) => p.id));
const entries: Record<string, string[]> = {};
const unknownFolders: string[] = [];

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

    if (files.length > 0) {
      entries[folder.name] = files.map((file) => `/img/products/${folder.name}/${file}`);
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
const missing = [...knownIds].filter((id) => !entries[id]);
if (missing.length > 0) {
  console.log(`[media] encore en illustration : ${missing.join(', ')}`);
}
