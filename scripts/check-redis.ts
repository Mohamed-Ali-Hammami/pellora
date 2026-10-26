/**
 * Vérifie que la persistance Redis est réellement joignable.
 *
 * Usage : npm run redis:check
 *
 * À lancer après avoir renseigné UPSTASH_REDIS_REST_URL et
 * UPSTASH_REDIS_REST_TOKEN dans `.env.local` (développement) ou dans les
 * variables d'environnement de l'hébergeur (production).
 *
 * POURQUOI UN SCRIPT PLUTÔT QU'UN TEST. Le site démarre et fonctionne sans
 * Redis : `getStore()` bascule silencieusement sur le magasin mémoire. Une
 * URL mal recopiée ne provoque donc aucune erreur visible — seulement des
 * commandes qui disparaissent au redémarrage, ce qu'on ne découvre qu'après
 * avoir perdu une vraie vente. Ce script transforme cette panne silencieuse
 * en message explicite, avant la mise en production.
 *
 * Le script écrit, relit et supprime une clé de test préfixée `check:` ;
 * il ne touche à aucune commande.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Charge `.env.local` si présent.
 *
 * `tsx` n'injecte pas les fichiers `.env` — contrairement à `next dev`. Sans
 * cette lecture, le script dirait « non configuré » alors que le site, lui,
 * trouve bien les variables : le pire des diagnostics, celui qui envoie
 * chercher le problème au mauvais endroit.
 */
function chargerEnvLocal(): void {
  const chemin = join(process.cwd(), '.env.local');
  if (!existsSync(chemin)) return;

  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    const nette = ligne.trim();
    if (nette === '' || nette.startsWith('#')) continue;
    const sep = nette.indexOf('=');
    if (sep === -1) continue;
    const clef = nette.slice(0, sep).trim();
    const valeur = nette.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[clef] === undefined) process.env[clef] = valeur;
  }
}

/** Tronque un secret pour l'afficher sans le divulguer. */
function masquer(valeur: string): string {
  if (valeur.length <= 8) return '*'.repeat(valeur.length);
  return `${valeur.slice(0, 4)}…${valeur.slice(-4)} (${valeur.length} caractères)`;
}

async function main(): Promise<void> {
  chargerEnvLocal();

  const url = process.env.UPSTASH_REDIS_REST_URL ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

  if (url === '' || token === '') {
    console.error('✗ Persistance NON configurée.');
    console.error('');
    console.error(`  UPSTASH_REDIS_REST_URL   : ${url === '' ? 'vide' : url}`);
    console.error(`  UPSTASH_REDIS_REST_TOKEN : ${token === '' ? 'vide' : masquer(token)}`);
    console.error('');
    console.error('  Les deux valeurs se récupèrent sur console.upstash.com, dans la');
    console.error('  base Redis, section « REST API » : « UPSTASH_REDIS_REST_URL » et');
    console.error('  « UPSTASH_REDIS_REST_TOKEN » sont donnés tels quels, à recopier.');
    console.error('');
    console.error('  En l\'état, le site utilise le magasin mémoire : les commandes');
    console.error('  sont perdues à chaque redémarrage.');
    process.exit(1);
  }

  if (!url.startsWith('https://')) {
    console.error(`✗ UPSTASH_REDIS_REST_URL ne commence pas par https:// : ${url}`);
    console.error('  Attendu : une URL REST (https://xxx.upstash.io), pas une URL');
    console.error('  de connexion redis:// ni rediss://.');
    process.exit(1);
  }

  console.log(`URL   : ${url}`);
  console.log(`Token : ${masquer(token)}`);
  console.log('');

  // Import tardif : le client lit l'environnement à la construction, donc
  // après `chargerEnvLocal()`.
  const { Redis } = await import('@upstash/redis');
  const redis = Redis.fromEnv();

  const clef = `check:${Date.now()}`;
  const temoin = `pellora-${Math.random().toString(36).slice(2)}`;

  try {
    await redis.set(clef, temoin, { ex: 60 });
    const relu = await redis.get<string>(clef);
    await redis.del(clef);

    if (relu !== temoin) {
      console.error(`✗ Écriture acceptée mais relecture incohérente : ${String(relu)}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Redis injoignable.');
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    console.error('  Causes habituelles : token d\'une autre base, token « read-only »');
    console.error('  (il faut celui en écriture), ou base supprimée.');
    process.exit(1);
  }

  console.log('✓ Redis joignable, écriture et relecture vérifiées.');
  console.log('  Les commandes survivront aux redémarrages.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
