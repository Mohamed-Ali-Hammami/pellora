/**
 * Bandeau « données de démonstration ».
 *
 * Il n'est pas décoratif : le catalogue livré contient des modèles, des
 * puissances et des classes énergétiques fictifs. Afficher un appareil de
 * chauffage avec des caractéristiques inventées, sur un site qui prend des
 * paiements, est une pratique commerciale trompeuse. Le bandeau reste visible
 * jusqu'à ce que NEXT_PUBLIC_DEMO_CATALOG soit mis à « false », ce qui doit
 * se faire au moment où les vraies données du fournisseur sont saisies.
 */

import { isDemoCatalog } from '@/lib/catalog';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export function DemoBanner({ dict }: { dict: Dictionary }) {
  if (!isDemoCatalog) return null;

  return (
    <div role="status" className="border-b border-warn/25 bg-[#fdf6e7]">
      <p className="container-page flex items-start gap-2 py-2 text-xs leading-relaxed text-[#7a4a06]">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.6L15 14H1L8 1.6z" strokeLinejoin="round" />
          <path d="M8 6v3.4M8 11.4v.2" strokeLinecap="round" />
        </svg>
        <span>{dict.common.demoBanner}</span>
      </p>
    </div>
  );
}
