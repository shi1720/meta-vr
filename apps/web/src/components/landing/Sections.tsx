import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { APP_URL, DEMO_URL } from '../../lib/config';
import { COUNTS } from '../../lib/catalog';
import { SOURCES } from '../../lib/sources';
import { Cite } from '../Cite';
import { Icon } from '../Icon';
import type { IconName } from '../Icon';
import { FeedbackIllustration, GardenIllustration, StepInsideIllustration, WatchIllustration } from './Illustrations';

// ---------------------------------------------------------------------------
// Why
// ---------------------------------------------------------------------------

export function Why() {
  return (
    <section id="why" className="section why" aria-labelledby="why-title">
      <div className="container why-grid">
        <div className="why-story">
          <p className="eyebrow">Why Signsprout</p>
          <h2 id="why-title">Most deaf babies are born to parents who don’t sign. Yet.</h2>
          <p className="lede">
            The newborn hearing screen says “refer”. A few weeks later you learn your baby is deaf, and you want to talk
            with them now, not in a year. But classes are far away, evenings are short, and a video on your phone can’t
            tell you whether your fingers are right.
          </p>
          <p className="lede">
            Signsprout turns five spare minutes into real signing practice, with a patient guide that checks your hands
            and a garden that shows how far you’ve come.
          </p>
          <p className="why-window">
            <Icon name="sparkle" size={20} />
            <span>
              The first months matter. Deaf children of hearing parents who were exposed to ASL before six months had
              age-expected vocabularies.
              <Cite id="caselli" />
            </span>
          </p>
        </div>
        <ul className="stats" aria-label="Key facts">
          <li className="stat stat-sprout">
            <span className="stat-value">
              90%<small>+</small>
            </span>
            <span className="stat-label">
              of deaf children are born to hearing parents.
              <Cite id="nidcd" />
            </span>
          </li>
          <li className="stat stat-coral">
            <span className="stat-value">22.9%</span>
            <span className="stat-label">
              of families with deaf children regularly sign at home.
              <Cite id="lieberman" />
            </span>
          </li>
          <li className="stat stat-honey">
            <span className="stat-value">6,272</span>
            <span className="stat-label">
              US babies were identified as deaf or hard of hearing in 2022 alone.
              <Cite id="cdc" />
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

const STEPS = [
  {
    title: 'Watch',
    body: 'Sprout, your signing buddy, shows the word face to face with glowing hands. Slow it down any time.',
    ill: <WatchIllustration />,
    tone: 'ghost',
  },
  {
    title: 'Step inside',
    body: 'Guide hands appear inside your own space, from your point of view. Put your hands in them and follow along.',
    ill: <StepInsideIllustration />,
    tone: 'honey',
  },
  {
    title: 'Sign it yourself',
    body: 'The guide fades. Signsprout checks handshape, then place, then movement, then the final handshape, with a tip for each finger.',
    ill: <FeedbackIllustration />,
    tone: 'coral',
  },
  {
    title: 'Grow your garden',
    body: 'Every sign you learn plants a flower. Spaced repetition brings it back just before you’d forget.',
    ill: <GardenIllustration />,
    tone: 'sprout',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="section how surface-paper-2" aria-labelledby="how-title">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title">From watching to signing in about a minute.</h2>
          <p className="lede">
            Each new sign moves through four steps, and each session ends on a sign you already know.
          </p>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`step tone-${s.tone}`}>
              <div className="step-art">{s.ill}</div>
              <div className="step-body">
                <span className="step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The science: first person
// ---------------------------------------------------------------------------

export function Science() {
  const bars = [
    { label: 'Face-to-face model (study 2)', sub: 'The model’s right is on your left', value: 20.6, tone: 'muted' },
    {
      label: 'Model flipped to match the learner’s mirroring (study 2)',
      sub: 'Left and right line up',
      value: 0.9,
      tone: 'sprout',
    },
  ];
  const max = 25;
  return (
    <section id="science" className="section science surface-ink on-ink" aria-labelledby="science-title">
      <div className="science-bg" aria-hidden="true" />
      <div className="container science-grid">
        <div>
          <p className="eyebrow">Why first-person</p>
          <h2 id="science-title">Face to face, left and right flip. So the guide hands sit on your side.</h2>
          <p className="lede">
            When a signer faces you, their right hand is on your left. Fluent signers flip that without thinking;
            beginners don’t. In one study, hearing non-signers copying a face-to-face model got sideways movements wrong{' '}
            <strong>24.3%</strong> of the time. In a second study, a model that matched their mirroring cut those errors
            from 20.6% to 0.9%.
            <Cite id="shield" />
          </p>
          <p className="lede">
            So in Signsprout the guide hands appear where <em>your</em> hands are, seen from your eyes. And, as the
            research on guidance recommends, they fade as you improve, so you learn the sign rather than learning to
            follow.
            <Cite id="hsieh" />
          </p>
          <Link to="/dictionary/hello" className="btn btn-ghost">
            <Icon name="swap" size={18} />
            Try both views on HELLO
          </Link>
        </div>
        <figure className="chart-card" aria-labelledby="chart-title">
          <figcaption id="chart-title" className="chart-title">
            <strong>Errors on sideways movements</strong>
            <span>Hearing non-signers, Shield &amp; Meier (2018), study 2</span>
          </figcaption>
          <div className="bars" role="list">
            {bars.map((b) => (
              <div
                key={b.label}
                className={`bar-row tone-${b.tone}`}
                role="listitem"
                title={`${b.label}: ${b.value}% errors`}
              >
                <div className="bar-label">
                  <span>{b.label}</span>
                  <small>{b.sub}</small>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(1.2, (b.value / max) * 100)}%` }} />
                  <span className="bar-value">{b.value}%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="chart-note">
            Matching the learner’s perspective all but eliminated these errors.
            <Cite id="shield" />
          </p>
          <div className="chart-footer">
            <Icon name="users" size={18} />
            <span>
              In a 60-person study, practising ASL in mixed reality with your own hands in view beat desktop video.
              <Cite id="shao" />
            </span>
          </div>
        </figure>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'fingers',
    title: 'Per-finger feedback',
    body: 'Handshape, then place, then movement, then the final handshape. Each fingertip lights up green, gold or coral, with a plain tip like “fold your ring finger down”.',
  },
  {
    icon: 'book',
    title: `${COUNTS.words} signs, A–Z and 1–10`,
    body: 'First ASL vocabulary for families: mealtime, bath and bedtime, feelings and little conversations, plus fingerspelling and numbers.',
  },
  {
    icon: 'sprout',
    title: 'A garden that remembers',
    body: 'Every sign grows a plant. Spaced repetition brings each one back just in time, and overdue plants droop until you practise.',
  },
  {
    icon: 'swap',
    title: 'Left-handed mode',
    body: 'Every sign mirrors automatically, guide hands and checker included, and the panel moves to the left, so your dominant hand leads.',
  },
  {
    icon: 'room',
    title: '“See my room” mode',
    body: 'Practise in passthrough on your own sofa, or in Sprout’s calm garden. Either way, your baby can be right beside you.',
  },
  {
    icon: 'accessibility',
    title: 'Accessible by design',
    body: 'Captions for every prompt, optional voice read-out, high contrast, calm motion, a limited-finger-range mode and “Continue with one hand”. Look-to-select (head gaze) and voice commands where the browser supports them.',
  },
  {
    icon: 'message',
    title: 'Sprout, your AI coach',
    body: 'Say “bath time and bedtime words” and Sprout plans your week, choosing only signs it can teach and check.',
  },
  {
    icon: 'wifiOff',
    title: 'Just a link, works offline',
    body: 'Runs in the Quest browser with no install or store. Progress saves on the headset and syncs when you pair a phone.',
  },
];

export function Features() {
  return (
    <section id="features" className="section features" aria-labelledby="features-title">
      <div className="container">
        <div className="section-head split">
          <div>
            <p className="eyebrow">What’s inside</p>
            <h2 id="features-title">Everything a busy parent needs, and nothing they don’t.</h2>
          </div>
          <p className="lede">
            Designed around real family life: five-minute sessions, a baby on your lap, and never a keyboard in VR.
          </p>
        </div>
        <ul className="feature-grid">
          {FEATURES.map((f) => (
            <li key={f.title} className="feature">
              <span className="feature-icon">
                <Icon name={f.icon} size={24} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  const monthly = 7.99;
  const annual = 59;
  const saving = Math.round((1 - annual / (monthly * 12)) * 100);
  return (
    <section id="pricing" className="section pricing surface-paper-2" aria-labelledby="pricing-title">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">For families · For programs</p>
          <h2 id="pricing-title">Start free. Grow together.</h2>
          <p className="lede">
            Built first for families with a deaf child, open to every learner. ASL is the third most-studied language in
            US colleges.
            <Cite id="mla" />
          </p>
        </div>

        <div className="plans">
          <article className="plan" aria-labelledby="plan-free">
            <header>
              <h3 id="plan-free">Free</h3>
              <p className="plan-for">For trying it tonight</p>
              <p className="price">
                <span className="amount">$0</span>
              </p>
            </header>
            <ul className="plan-list">
              <li>First words, Mealtime and Family units</li>
              <li>Fingerspelling A–Z and numbers 1–10</li>
              <li>Per-finger feedback and guide hands</li>
              <li>Your garden and streak, saved on the headset</li>
            </ul>
            <a className="btn btn-ghost btn-block" href={APP_URL}>
              Start free on Quest
            </a>
          </article>

          <article className="plan featured" aria-labelledby="plan-family">
            <span className="plan-badge">Best for families</span>
            <header>
              <h3 id="plan-family">Family</h3>
              <p className="plan-for">For the whole household</p>
              <div className="billing" role="radiogroup" aria-label="Billing period">
                <button type="button" role="radio" aria-checked={!yearly} onClick={() => setYearly(false)}>
                  Monthly
                </button>
                <button type="button" role="radio" aria-checked={yearly} onClick={() => setYearly(true)}>
                  Yearly <span className="save">−{saving}%</span>
                </button>
              </div>
              <p className="price" aria-live="polite">
                <span className="amount">{yearly ? `$${annual}` : `$${monthly}`}</span>
                <span className="per">{yearly ? '/ year' : '/ month'}</span>
              </p>
            </header>
            <ul className="plan-list">
              <li>All {COUNTS.total} signs, and every new unit</li>
              <li>Sprout, your AI coach</li>
              <li>Up to 4 family members</li>
              <li>Family dashboard and share links</li>
              <li>Cloud sync between headset and phone</li>
            </ul>
            <a className="btn btn-primary btn-block" href={APP_URL}>
              Start on Meta Quest
            </a>
          </article>

          <article className="plan" aria-labelledby="plan-programs">
            <header>
              <h3 id="plan-programs">Programs</h3>
              <p className="plan-for">Early intervention, schools, audiology</p>
              <p className="price">
                <span className="from">from</span>
                <span className="amount">$39</span>
                <span className="per">/ family / year</span>
              </p>
            </header>
            <ul className="plan-list">
              <li>Seats for every family you serve</li>
              <li>Headset lending kits</li>
              <li>Progress reports, shared with family consent</li>
              <li>Onboarding for staff and Deaf mentors</li>
            </ul>
            <Link className="btn btn-ghost btn-block" to="/dashboard?sample=1">
              See a sample progress report
            </Link>
          </article>
        </div>

        <div className="free-banner">
          <span className="free-icon">
            <Icon name="heart" size={22} />
          </span>
          <p>
            <strong>Planned: free for families of deaf children under 3</strong>, funded through partner programs. Early
            intervention and audiology teams: the plan is to cover the Family plan for the babies you serve.
          </p>
        </div>
        <p className="pricing-note muted">Planned launch pricing. Everything in this preview is free.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Built responsibly
// ---------------------------------------------------------------------------

export function Responsible() {
  const items: { icon: IconName; title: string; body: ReactNode }[] = [
    {
      icon: 'checkCircle',
      title: 'Compared with trusted references',
      body: (
        <>
          We compared each sign with{' '}
          <a className="link" href="https://www.handspeak.com/" target="_blank" rel="noreferrer">
            Handspeak
          </a>{' '}
          (Jolanta Lapiak) and{' '}
          <a className="link" href="https://www.lifeprint.com/" target="_blank" rel="noreferrer">
            Lifeprint / ASL University
          </a>{' '}
          (Dr. Bill Vicars). No Deaf signer has reviewed Signsprout yet; paid review by Deaf signers comes before
          launch. Each dictionary page links its sources.
        </>
      ),
    },
    {
      icon: 'message',
      title: 'A learning aid, not a translator',
      body: 'Signsprout never claims to interpret or translate. It helps you practise, and this site links to Deaf-led resources and Deaf Mentor programs.',
    },
    {
      icon: 'face',
      title: 'Honest about limits',
      body: 'Facial grammar matters in ASL, but hand tracking can’t see your face, so it’s mentioned as a tip, not scored. For fingerspelled letters that hand tracking confuses (such as M, N, T, E, A, S), Signsprout is lenient and says so.',
    },
    {
      icon: 'globe',
      title: 'Variants are real',
      body: 'Signs vary by region and family. Common variants are listed; for now the checker accepts one form.',
    },
    {
      icon: 'lock',
      title: 'Your hands stay yours',
      body: 'Hand tracking is processed on the headset and never uploaded. Only your progress syncs, and only if you pair.',
    },
    {
      icon: 'users',
      title: 'Next: Deaf-led',
      body: 'The plan: paid review of every sign by Deaf signers before launch, and Deaf co-leadership of the content, with pay and a veto over what we teach. That isn’t in place yet.',
    },
  ];
  return (
    <section id="responsible" className="section responsible" aria-labelledby="responsible-title">
      <div className="container">
        <div className="section-head split">
          <div>
            <p className="eyebrow">Built responsibly</p>
            <h2 id="responsible-title">ASL is a language and a culture. We treat it that way.</h2>
          </div>
          <p className="lede">
            Signsprout is a practice tool, not a teacher. These are the rules it follows today, and the Deaf-led future
            it’s working toward.
          </p>
        </div>
        <ul className="resp-grid">
          {items.map((it) => (
            <li key={it.title} className="resp">
              <Icon name={it.icon} size={22} />
              <div>
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="resp-more">
          <Link className="link" to="/privacy">
            Read our privacy &amp; ethics commitments
          </Link>
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'Do I need a Meta Quest?',
    a: (
      <>
        For the full experience, yes: Signsprout runs in the Quest browser with hand tracking, and there’s nothing to
        install. Without a headset you can explore every sign in 3D in the{' '}
        <Link className="link" to="/dictionary">
          dictionary
        </Link>{' '}
        and{' '}
        <a className="link" href={DEMO_URL}>
          watch the demo
        </a>{' '}
        in any browser. Programs can lend headsets to families.
      </>
    ),
  },
  {
    q: 'What if I’m left-handed?',
    a: 'Turn on left-handed mode and every sign mirrors, including the guide hands and the checker, and the panel moves to the left. Your dominant hand leads, just as it would in ASL.',
  },
  {
    q: 'Is this a replacement for a Deaf teacher?',
    a: 'No. Signsprout is practice for the minutes between lessons. ASL is a full language, with grammar on the face and body and a rich culture. Learn it with Deaf teachers, Deaf mentors and the Deaf community. The links at the bottom of this page, including Deaf Mentor programs and Gallaudet’s ASL Connect, are a good place to start.',
  },
  {
    q: 'Which sign language does it teach?',
    a: 'American Sign Language (ASL). Signsprout covers first ASL vocabulary for families, not the whole language. Sign languages differ around the world. Indian Sign Language (ISL) and British Sign Language (BSL) are on our roadmap, built with Deaf signers from those communities.',
  },
  {
    q: 'What happens to my data?',
    a: (
      <>
        Hand tracking is processed on your headset and never leaves it: no video, no camera images, no hand recordings.
        If you pair a phone, only your progress syncs (which signs, how well, practice minutes). See{' '}
        <Link className="link" to="/privacy">
          privacy &amp; ethics
        </Link>
        .
      </>
    ),
  },
  {
    q: 'How much time does it take?',
    a: 'About five minutes a day. A session mixes a few reviews with up to three new signs and always ends on one you know. Short, daily practice beats a long session once a week.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="section faq" aria-labelledby="faq-title">
      <div className="container narrow">
        <div className="section-head center">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-title">Good questions, straight answers.</h2>
        </div>
        <div className="faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>
                <span>{f.q}</span>
                <span className="faq-toggle" aria-hidden="true" />
              </summary>
              <div className="faq-answer">
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final CTA + sources
// ---------------------------------------------------------------------------

export function FinalCta() {
  return (
    <section className="final-cta surface-ink on-ink" aria-labelledby="cta-title">
      <div className="final-glow" aria-hidden="true" />
      <div className="container final-inner">
        <h2 id="cta-title">
          Five minutes tonight. <em>A first sign tomorrow.</em>
        </h2>
        <p className="lede">Open Signsprout in your Quest browser. Your garden starts with HELLO.</p>
        <div className="hero-ctas center">
          <a className="btn btn-primary btn-lg" href={APP_URL}>
            <Icon name="headset" size={22} />
            Start on Meta Quest
          </a>
          <Link className="btn btn-ghost btn-lg" to="/dictionary">
            <Icon name="book" size={20} />
            Browse the dictionary
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Sources() {
  return (
    <section className="sources" aria-labelledby="sources-title">
      <div className="container">
        <h2 id="sources-title">Sources</h2>
        <ol>
          {SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
              <span className="muted"> {s.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
