/**
 * Cherche la plus grande résolution disponible pour un visuel du relevé.
 *
 * Usage : npm run media:probe
 *         npm run media:probe -- <url-du-cdn>
 *
 * POURQUOI CE SCRIPT.
 *
 * `media:fetch` ramène des images de 470 × 470 px, sous le seuil de 600 px que
 * `media:scan` impose. Avant de baisser ce seuil — c'est-à-dire avant
 * d'accepter des photos floues sur la boutique — il faut savoir si une
 * variante plus grande existe. La question se tranche par l'essai, pas par la
 * supposition : chaque CDN nomme ses tailles à sa façon, et la page relevée ne
 * montre que celles qu'elle utilise.
 *
 * Le script demande une liste de candidats et annonce, pour chacun, le code
 * HTTP et la résolution réellement reçue. Il n'écrit rien.
 *
 * À lancer depuis un poste ayant accès au CDN : la politique réseau d'une
 * session cloud le refuse.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RELEVES = 'data/releves';

/** Dimensions d'une image JPEG, PNG ou WebP, lues dans son en-tête. */
function dimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP : conteneur RIFF. Le format « VP8X » porte la taille sur 24 bits.
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return {
        width: 1 + (buf.readUIntLE(24, 3) & 0xffffff),
        height: 1 + (buf.readUIntLE(27, 3) & 0xffffff),
      };
    }
    if (chunk === 'VP8 ' && buf.length > 30) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1] ?? 0;
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
 * Candidats à essayer.
 *
 * Deux familles d'hypothèses, et il faut les distinguer dans le résultat :
 *   — les variantes NOMMÉES dans le chemin (small / medium / large / original…)
 *     sont des fichiers pré-générés : si le nom n'existe pas, c'est un 404 net ;
 *   — les paramètres de REDIMENSIONNEMENT (`?w=`) supposent un service de
 *     transformation à la volée. S'ils sont ignorés, le serveur répond 200 avec
 *     l'image d'origine — c'est le piège : un 200 ne prouve rien, seule la
 *     résolution reçue compte.
 */
function candidats(url: string): { libelle: string; url: string }[] {
  const out: { libelle: string; url: string }[] = [];
  const nom = (taille: string) => url.replace(/\/images\/[a-z0-9_-]+\//, `/images/${taille}/`);

  for (const taille of ['original', 'xlarge', 'xl', 'zoom', 'full', 'large', 'medium', 'small']) {
    out.push({ libelle: `chemin « ${taille} »`, url: nom(taille) });
  }
  for (const largeur of [2000, 1600, 1200, 800]) {
    out.push({ libelle: `?w=${largeur} sur « large »`, url: `${nom('large')}?w=${largeur}&quality=85` });
  }
  out.push({ libelle: 'URL relevée telle quelle', url });
  return out;
}

/** Première URL d'image trouvée dans les relevés, pour n'avoir rien à saisir. */
function premiereUrl(): string | null {
  if (!existsSync(RELEVES)) return null;
  for (const fichier of readdirSync(RELEVES).filter((f) => f.endsWith('.json'))) {
    const data: unknown = JSON.parse(readFileSync(join(RELEVES, fichier), 'utf8'));
    if (typeof data !== 'object' || data === null) continue;
    for (const [cle, valeur] of Object.entries(data)) {
      if (cle.startsWith('_') || !Array.isArray(valeur)) continue;
      for (const item of valeur as { imageSource?: string }[]) {
        if (item.imageSource) return item.imageSource;
      }
    }
  }
  return null;
}

async function main(): Promise<void> {
  const fourni = process.argv.slice(2).find((a) => a.startsWith('http'));
  const url = fourni ?? premiereUrl();

  if (!url) {
    console.error('Aucune URL : passez-en une en argument, ou renseignez');
    console.error('« imageSource » dans data/releves/*.json.');
    process.exit(1);
  }

  console.log('');
  console.log(`Visuel sondé : ${url}`);
  console.log('');

  let meilleure = 0;
  let meilleureUrl = '';

  for (const { libelle, url: candidat } of candidats(url)) {
    let ligne = `  ${libelle.padEnd(26)} `;
    try {
      const reponse = await fetch(candidat);
      if (!reponse.ok) {
        console.log(`${ligne}HTTP ${reponse.status}`);
        continue;
      }
      const buf = Buffer.from(await reponse.arrayBuffer());
      const dim = dimensions(buf);
      const octets = `${Math.round(buf.length / 1024)} Ko`;
      if (!dim) {
        console.log(`${ligne}HTTP 200, ${octets}, résolution illisible`);
        continue;
      }
      ligne += `HTTP 200  ${String(dim.width).padStart(5)} × ${String(dim.height).padEnd(5)} ${octets}`;
      const cote = Math.min(dim.width, dim.height);
      if (cote > meilleure) {
        meilleure = cote;
        meilleureUrl = candidat;
      }
      console.log(ligne);
    } catch (error) {
      console.log(`${ligne}échec réseau (${error instanceof Error ? error.message : 'inconnu'})`);
    }
  }

  console.log('');
  if (meilleure === 0) {
    console.log('Aucun candidat n’a répondu. Vérifiez l’accès réseau au CDN.');
    return;
  }

  console.log(`Meilleure résolution obtenue : ${meilleure} px de côté`);
  console.log(`  ${meilleureUrl}`);
  console.log('');
  if (meilleure >= 600) {
    console.log('Au-dessus du seuil de 600 px : cette variante est exploitable.');
    console.log('Dites-le moi, j’adapte media:fetch pour la demander en premier.');
  } else {
    console.log('SOUS le seuil de 600 px, et c’est le maximum que le CDN expose.');
    console.log('Une page de liste ne porte que des vignettes ; la haute résolution');
    console.log('est sur la fiche produit, ou chez le fournisseur.');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
