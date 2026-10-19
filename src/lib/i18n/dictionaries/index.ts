/**
 * Point d'accès aux dictionnaires.
 *
 * À n'importer QUE depuis un composant serveur. Les composants client
 * reçoivent les textes dont ils ont besoin en propriétés : importer ce module
 * depuis le navigateur embarquerait les quatre langues dans le bundle.
 */

import fr, { type Dictionary } from './fr';
import en from './en';
import nl from './nl';
import es from './es';
import type { Locale } from '../config';

export const dictionaries: Record<Locale, Dictionary> = { fr, en, nl, es };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
