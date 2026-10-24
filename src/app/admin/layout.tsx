import '../globals.css';

/**
 * Mise en page du back-office.
 *
 * Le site n'a pas de `src/app/layout.tsx` : `[locale]` sert de racine aux
 * pages publiques, pour poser la vraie langue sur `<html>`. `/admin` vit hors
 * de cet arbre et a donc besoin de sa propre racine.
 *
 * Pas d'en-tête, pas de pied de page, pas de panier : un outil interne n'a
 * rien à faire de la navigation de la boutique, et chaque composant en moins
 * est un composant qui ne peut pas casser la page sur laquelle l'équipe
 * valide des paiements.
 */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-sand">{children}</body>
    </html>
  );
}
