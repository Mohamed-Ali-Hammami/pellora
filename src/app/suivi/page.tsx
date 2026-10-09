import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackingForm } from './tracking-form';

export const metadata: Metadata = {
  title: 'Suivre ma commande',
  description: 'Consultez l’état de votre commande avec votre référence et votre adresse e-mail.',
  alternates: { canonical: '/suivi' },
};

export default function TrackingPage() {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl">Suivre ma commande</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Indiquez la référence reçue par e-mail et l’adresse utilisée lors de la commande.
        </p>
        <Suspense fallback={<p className="mt-8 text-muted">Chargement…</p>}>
          <TrackingForm />
        </Suspense>
      </div>
    </div>
  );
}
