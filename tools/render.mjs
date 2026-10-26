/**
 * Rendu de pages dans un vrai navigateur, pilote depuis Python.
 *
 *   node tools/render.mjs                  # JSONL sur stdin -> JSONL sur stdout
 *   node tools/render.mjs --essai <url>    # un seul rendu, pour verifier
 *
 * A QUOI CA SERT, ET A QUOI CA NE SERT PAS.
 *
 * `scrape.py` lit le HTML initial. Cela couvre deja beaucoup : la plupart des
 * sites rendus cote navigateur deposent leur etat dans la page sous forme de
 * JSON. Mais certaines pages ne contiennent VRAIMENT rien avant l'execution du
 * JavaScript : le contenu est demande apres coup par le script de la page. La,
 * aucune lecture de HTML ne peut suffire, et il faut un navigateur qui execute
 * la page comme un visiteur. C'est ce que fait ce script.
 *
 * Ce n'est pas un outil pour contourner une protection anti-robot. Si un site
 * refuse deliberement le trafic automatise, un navigateur pilote ne change
 * rien : il s'annonce comme tel. Ce script execute le JavaScript, accepte les
 * cookies et garde une session — il ne se deguise pas.
 *
 * POURQUOI UN PROCESSUS QUI DURE, ET NON UN APPEL PAR PAGE.
 *
 * Lancer un navigateur coute une a deux secondes et une centaine de megaoctets.
 * Le faire par URL rendrait la collecte plus lente que le reseau. Ce script
 * ouvre donc le navigateur UNE fois, puis traite les demandes qui arrivent
 * ligne par ligne sur son entree standard et repond sur sa sortie. Python
 * garde l'orchestration et le regulateur de debit ; ce script ne fait que
 * rendre.
 *
 * PROTOCOLE. Une demande par ligne :
 *     {"id": 1, "url": "https://…", "attente": "reseau", "delai": 20000}
 * Une reponse par ligne :
 *     {"id": 1, "ok": true, "statut": 200, "url": "…", "html": "…", "ms": 1234}
 * Les traces partent sur stderr, jamais sur stdout : une seule ligne parasite
 * sur stdout casserait le protocole.
 *
 * TROIS CHOIX QUI CHANGENT LE RESULTAT
 *
 *   — contexte PERSISTANT : cookies et consentement survivent d'une page a
 *     l'autre et d'une execution a l'autre. Outre le confort, cela evite de
 *     redemander la banniere de consentement a chaque page, donc des requetes
 *     en moins pour le site ;
 *   — la banniere de consentement est cliquee. Sans cela, beaucoup de sites
 *     europeens ne rendent rien d'exploitable — c'est un geste de visiteur,
 *     pas un contournement ;
 *   — images, polices et videos sont bloquees par defaut : on cherche le HTML,
 *     pas les octets des visuels, dont on garde les URL. Le temps de rendu est
 *     divise par trois et le trafic par dix, ce qui menage aussi le site.
 */

import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Profil persistant, reutilise d'une execution a l'autre. */
const PROFIL = process.env.RENDER_PROFIL || join(tmpdir(), 'collecte-profil');

/** Chemin d'un Chromium deja installe, s'il n'est pas la ou Playwright l'attend. */
const CHROMIUM = process.env.RENDER_CHROMIUM || undefined;

/**
 * Playwright est charge par `require` et non par `import`.
 *
 * La resolution ESM ignore NODE_PATH et les installations globales : un
 * `import 'playwright'` echoue des que le paquet n'est pas dans le
 * node_modules du projet. `createRequire` retablit la resolution CommonJS,
 * qui les trouve. Le module fonctionne donc qu'il soit installe localement,
 * globalement, ou pointe par NODE_PATH.
 */
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try {
    ({ chromium } = require('playwright-core'));
  } catch {
    process.stderr.write(
      'playwright est introuvable. Installez-le :\n' +
        '  npm install playwright\n' +
        '  npx playwright install chromium\n',
    );
    process.exit(1);
  }
}

const BLOQUES = new Set(['image', 'font', 'media']);

/**
 * Selecteurs d'acceptation du consentement, dans l'ordre.
 *
 * Didomi d'abord : c'est la plateforme la plus repandue en Europe et son
 * identifiant est stable. Les suivants couvrent les formes courantes. On
 * s'arrete au premier qui repond.
 */
const CONSENTEMENT = [
  '#didomi-notice-agree-button',
  'button#onetrust-accept-btn-handler',
  '[aria-label*="Aceptar" i]',
  '[aria-label*="Accepter" i]',
  'button:has-text("Aceptar y continuar")',
  'button:has-text("Aceptar todo")',
  'button:has-text("Accepter et continuer")',
  'button:has-text("Tout accepter")',
  'button:has-text("Accept all")',
  'button:has-text("I agree")',
];

function trace(...args) {
  process.stderr.write(args.join(' ') + '\n');
}

async function ouvre({ sansTete = true, avecImages = false } = {}) {
  mkdirSync(PROFIL, { recursive: true });

  const contexte = await chromium.launchPersistentContext(PROFIL, {
    headless: sansTete,
    ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
    // Langue, fuseau et fenetre coherents : on lit un site espagnol, autant
    // qu'il nous serve sa version espagnole.
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport: { width: 1440, height: 900 },
  });

  if (!avecImages) {
    await contexte.route('**/*', (route) => {
      if (BLOQUES.has(route.request().resourceType())) return route.abort();
      return route.continue();
    });
  }

  return contexte;
}

/** Clique la banniere de consentement, si elle est la. Jamais bloquant. */
async function accepteConsentement(page) {
  for (const selecteur of CONSENTEMENT) {
    try {
      const bouton = page.locator(selecteur).first();
      if (await bouton.isVisible({ timeout: 700 })) {
        await bouton.click({ timeout: 2500 });
        trace('[consentement] accepté via', selecteur);
        await page.waitForTimeout(400);
        return selecteur;
      }
    } catch {
      // Ce selecteur n'est pas la : au suivant. L'absence de banniere est le
      // cas normal apres la premiere visite, grace au profil persistant.
    }
  }
  return null;
}

async function rend(contexte, { url, attente = 'dom', delai = 25000, selecteur = null }) {
  const page = await contexte.newPage();
  const debut = Date.now();

  /*
   * Compte les requetes que la PAGE emet d'elle-meme.
   *
   * Le regulateur de Python ne voit que la navigation : une page qui appelle
   * ensuite son API trois fois genere trois requetes de plus, hors de son
   * budget. Les compter et les rapporter est le minimum honnete — sinon on
   * croit tenir 1 req/s en en envoyant quatre.
   */
  let requetes = 0;
  page.on('request', () => {
    requetes += 1;
  });

  try {
    const reponse = await page.goto(url, {
      waitUntil: attente === 'reseau' ? 'networkidle' : 'domcontentloaded',
      timeout: delai,
    });

    const consentement = await accepteConsentement(page);

    if (selecteur) {
      // Attendre un element precis est le seul moyen fiable de savoir que le
      // contenu utile est arrive. `networkidle` ne le garantit pas : une page
      // qui sonde un service en boucle n'est jamais « idle ».
      try {
        await page.locator(selecteur).first().waitFor({ timeout: 8000 });
      } catch {
        trace('[attente]', selecteur, 'jamais apparu');
      }
    } else if (attente === 'reseau') {
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    }

    const html = await page.content();
    return {
      ok: true,
      statut: reponse ? reponse.status() : 0,
      url: page.url(),
      html,
      consentement,
      ms: Date.now() - debut,
      octets: html.length,
      requetes,
    };
  } catch (erreur) {
    return {
      ok: false,
      statut: 0,
      url,
      raison: `${erreur?.name || 'Erreur'}: ${String(erreur?.message || erreur).split('\n')[0]}`,
      ms: Date.now() - debut,
      requetes,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sansTete = !args.includes('--fenetre');
  const avecImages = args.includes('--avec-images');

  const essai = args.indexOf('--essai');
  if (essai !== -1) {
    const url = args[essai + 1];
    if (!url) {
      trace('--essai demande une URL');
      process.exit(1);
    }
    const contexte = await ouvre({ sansTete, avecImages });
    const res = await rend(contexte, { url, attente: 'reseau' });
    await contexte.close();
    trace(
      `[essai] ok=${res.ok} statut=${res.statut} ${res.ms} ms ` +
        `${res.octets || 0} octets consentement=${res.consentement || 'aucun'}` +
        (res.raison ? ` raison=${res.raison}` : ''),
    );
    if (res.html) process.stdout.write(res.html);
    process.exit(res.ok ? 0 : 1);
  }

  const contexte = await ouvre({ sansTete, avecImages });
  trace('[prêt] navigateur ouvert, profil', PROFIL);
  // Signal de disponibilite : Python attend cette ligne avant d'envoyer.
  process.stdout.write(JSON.stringify({ pret: true }) + '\n');

  const lignes = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const ligne of lignes) {
    const brut = ligne.trim();
    if (!brut) continue;
    let demande;
    try {
      demande = JSON.parse(brut);
    } catch {
      process.stdout.write(JSON.stringify({ ok: false, raison: 'demande illisible' }) + '\n');
      continue;
    }
    if (demande.fin) break;
    const res = await rend(contexte, demande);
    process.stdout.write(JSON.stringify({ id: demande.id, ...res }) + '\n');
  }

  await contexte.close();
  trace('[fin] navigateur fermé');
}

main().catch((erreur) => {
  trace('[fatal]', erreur?.stack || String(erreur));
  process.exit(1);
});
