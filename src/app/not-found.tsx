import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-3 text-4xl">Cette page n’existe pas</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-soft">
        Le lien est peut-être erroné, ou la page a été déplacée. La boutique, elle, est toujours la.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/produits" className="btn-primary">
          Voir la boutique
        </Link>
        <Link href="/" className="btn-secondary">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
