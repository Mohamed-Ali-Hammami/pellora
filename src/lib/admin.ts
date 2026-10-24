/**
 * Accès au back-office.
 *
 * Un mot de passe partagé, pas de comptes nommés. C'est le bon niveau ici :
 * la page ne fait que lire des commandes et les faire avancer d'un état,
 * l'équipe tient dans une pièce, et un système de comptes apporterait une
 * surface à maintenir sans rien protéger de plus.
 *
 * Ce que ce module fait quand même sérieusement :
 *
 *  - le mot de passe ne voyage jamais dans le cookie. Celui-ci porte un HMAC
 *    calculé avec le mot de passe comme clé ; changer le mot de passe invalide
 *    donc toutes les sessions ouvertes, ce qui est exactement ce qu'on veut
 *    quand quelqu'un quitte l'équipe ;
 *  - les comparaisons sont à temps constant. Un `===` sur un secret laisse
 *    fuir sa longueur et son préfixe par le temps de réponse ;
 *  - sans `ADMIN_PASSWORD`, le back-office est fermé, pas ouvert. Un défaut de
 *    configuration ne doit jamais exposer les commandes.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'admin.ts a été importé côté client : le mot de passe du back-office fuirait dans le bundle. ' +
      'Déplacez cet import vers une route API ou un composant serveur.',
  );
}
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'pellora_admin';

/** Durée d'une session : une journée de travail, pas davantage. */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

function password(): string {
  const value = process.env['ADMIN_PASSWORD'];
  return value && value.trim().length > 0 ? value.trim() : '';
}

export function isAdminConfigured(): boolean {
  return password().length >= 12;
}

/**
 * Valeur déposée dans le cookie.
 *
 * Pas de date d'expiration à l'intérieur : c'est le cookie lui-même qui
 * expire, et une valeur stable permet de vérifier sans stockage serveur.
 */
function expectedToken(): string {
  return createHmac('sha256', password()).update('admin-session').digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // `timingSafeEqual` exige des longueurs égales : on compare d'abord un
  // condensé, dont la longueur ne dépend pas de l'entrée.
  const hashA = createHmac('sha256', 'longueur').update(bufA).digest();
  const hashB = createHmac('sha256', 'longueur').update(bufB).digest();
  return timingSafeEqual(hashA, hashB);
}

/** Mot de passe saisi correct ? Renvoie le jeton de session, ou `null`. */
export function signIn(submitted: string): string | null {
  if (!isAdminConfigured()) return null;
  if (!constantTimeEqual(submitted, password())) return null;
  return expectedToken();
}

/** Cookie présenté valide ? */
export function isSignedIn(token: string | undefined): boolean {
  if (!isAdminConfigured() || !token) return false;
  return constantTimeEqual(token, expectedToken());
}
