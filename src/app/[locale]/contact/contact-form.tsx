'use client';

/**
 * Formulaire de contact.
 *
 * Il compose un message et l'ouvre dans le logiciel de messagerie du
 * visiteur, au lieu de l'envoyer depuis le serveur. Trois raisons assumées :
 * aucun formulaire exposé donc aucun robot à spammer, aucune donnée
 * personnelle stockée côté site, et le visiteur garde une copie de ce qu'il a
 * écrit dans ses messages envoyés. La mention sous le bouton le dit
 * explicitement — un formulaire qui se comporte autrement qu'annoncé fait
 * perdre la confiance qu'il devait créer.
 *
 * Pour passer à un envoi serveur, créer une route API qui utilise
 * `lib/email/send.ts` et y poster ces mêmes champs.
 */

import { useState } from 'react';

interface Props {
  to: string;
  labels: {
    name: string;
    email: string;
    message: string;
    messagePlaceholder: string;
    submit: string;
    hint: string;
    required: string;
  };
}

export function ContactForm({ to, labels }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const ready = name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    const subject = encodeURIComponent(`${labels.message} — ${name.trim()}`);
    const body = encodeURIComponent(`${message.trim()}\n\n—\n${name.trim()}\n${email.trim()}`);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="contact-name" label={labels.name} value={name} onChange={setName} />
      <Field id="contact-email" label={labels.email} value={email} onChange={setEmail} type="email" />

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-ink">
          {labels.message}
        </label>
        <textarea
          id="contact-message"
          required
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={labels.messagePlaceholder}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm placeholder:text-muted"
        />
      </div>

      <button type="submit" disabled={!ready} className="btn-primary w-full sm:w-auto">
        {labels.submit}
      </button>

      <p className="text-xs text-muted">{labels.hint}</p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
      />
    </div>
  );
}
