import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';
import {
  invalidFields,
  validateField,
  type ContactField,
} from '../lib/contact-validate';

/**
 * The contact form (B-06b): a server-rendered React island (`client:visible`, never
 * `client:only`). The HTML it renders is a complete native form that posts to Formspree with
 * `_gotcha` (honeypot) and `_next` (redirect to /sent/), so it works with scripts off. Once
 * hydrated it adds inline validation, a `fetch` submit with `Accept: application/json`,
 * live-region errors and focus management. A failed or unreachable submit never loses the
 * visitor's text: the form stays and the message points at the email address.
 */
export interface ContactFormProps {
  action: string;
  next: string;
  address: string;
  labels: {
    name: string;
    email: string;
    subject: string;
    message: string;
    send: string;
  };
  success: string;
  errors: Record<ContactField | 'network', string>;
}

type Phase = 'idle' | 'sending' | 'sent' | 'failed';
type Errors = Partial<Record<ContactField, true>>;

/** The failure sentence with the address inside it turned into a real mailto link. */
function withMailto(text: string, address: string) {
  const i = text.indexOf(address);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <a href={`mailto:${address}`}>{address}</a>
      {text.slice(i + address.length)}
    </>
  );
}

export default function ContactForm({
  action,
  next,
  address,
  labels,
  success,
  errors: copy,
}: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [invalid, setInvalid] = useState<Errors>({});

  // Native validation bubbles stay on for visitors without scripts; here we replace them.
  useEffect(() => {
    if (formRef.current) formRef.current.noValidate = true;
  }, []);

  useEffect(() => {
    if (phase === 'sent') successRef.current?.focus();
  }, [phase]);

  const check = (field: ContactField, value: string) =>
    setInvalid((prev) => {
      const next = { ...prev };
      if (validateField(field, value)) delete next[field];
      else next[field] = true;
      return next;
    });

  // Re-check on typing only once a field has been flagged, so the first pass is not nagging.
  const onInput = (field: ContactField) => (e: ChangeEvent<HTMLElement>) => {
    if (invalid[field])
      check(field, (e.target as HTMLInputElement | HTMLTextAreaElement).value);
  };

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase === 'sending') return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const bad = invalidFields({
      email: String(data.get('email') ?? ''),
      message: String(data.get('message') ?? ''),
    });
    setInvalid(Object.fromEntries(bad.map((f) => [f, true])));
    if (bad[0]) {
      form.querySelector<HTMLElement>(`[name="${bad[0]}"]`)?.focus();
      return;
    }
    setPhase('sending');
    try {
      const res = await fetch(action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      setPhase(res.ok ? 'sent' : 'failed');
    } catch {
      setPhase('failed');
    }
  }

  const sent = phase === 'sent';

  return (
    <div className="contact-form-wrap">
      <form
        ref={formRef}
        className="contact-form"
        action={action}
        method="POST"
        onSubmit={(e) => void onSubmit(e)}
        hidden={sent}
        aria-busy={phase === 'sending'}
      >
        <input type="hidden" name="_next" value={next} />
        {/* Honeypot: people never see or reach it; bots fill it and Formspree drops the post. */}
        <div hidden>
          <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="field">
          <label htmlFor="cf-name">{labels.name}</label>
          <input id="cf-name" name="name" type="text" autoComplete="name" />
        </div>

        <div className="field">
          <label htmlFor="cf-email">{labels.email}</label>
          <input
            id="cf-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={invalid.email === true}
            aria-describedby="cf-email-error"
            onChange={onInput('email')}
            onBlur={(e) => check('email', e.target.value)}
          />
          <p className="field-error" id="cf-email-error" aria-live="polite">
            {invalid.email ? copy.email : ''}
          </p>
        </div>

        <div className="field">
          <label htmlFor="cf-subject">{labels.subject}</label>
          <input
            id="cf-subject"
            name="_subject"
            type="text"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="cf-message">{labels.message}</label>
          <textarea
            id="cf-message"
            name="message"
            rows={6}
            required
            aria-invalid={invalid.message === true}
            aria-describedby="cf-message-error"
            onChange={onInput('message')}
            onBlur={(e) => check('message', e.target.value)}
          />
          <p className="field-error" id="cf-message-error" aria-live="polite">
            {invalid.message ? copy.message : ''}
          </p>
        </div>

        <button type="submit" className="form-submit label">
          {labels.send}
        </button>
      </form>

      {/* Persistent live region: the failure text is injected into an element that exists. */}
      <div className="form-status" role="status">
        {phase === 'failed' ? (
          <p className="field-error">{withMailto(copy.network, address)}</p>
        ) : null}
      </div>

      {sent ? (
        <div
          ref={successRef}
          className="form-success"
          tabIndex={-1}
          role="status"
        >
          <p>{success}</p>
        </div>
      ) : null}
    </div>
  );
}
