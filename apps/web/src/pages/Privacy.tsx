import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { AUTHOR } from '../lib/config';
import { useTitle } from '../lib/hooks';
import '../styles/account.css';

const PROMISES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'hand',
    title: 'Your hands never leave the headset',
    body: 'Hand tracking is processed on the Quest, frame by frame, to check your sign. We don’t record, upload or keep hand data, camera images or video. Ever.',
  },
  {
    icon: 'sprout',
    title: 'Only progress syncs, and only if you pair',
    body: 'Without an account, everything stays on the headset. If you pair a phone, we store your progress: which signs you know, how well, when they’re due, practice minutes per day and your settings.',
  },
  {
    icon: 'mail',
    title: 'Just an email to sign in',
    body: 'Accounts use a one-time email code. No passwords, no phone number, no social logins. We use your email to sign you in and nothing else.',
  },
  {
    icon: 'link',
    title: 'Sharing is yours to control',
    body: 'Family links show a name, your garden and practice days: no email, no history of attempts. Turn a link off and it stops working immediately.',
  },
  {
    icon: 'message',
    title: 'What Sprout, the coach, sees',
    body: 'When you ask Sprout for a plan, your goal and a short progress summary (signs learned, signs you find tricky, your child’s first name if you added one) are sent to our AI provider, Anthropic’s Claude, to write the plan. Sprout can only suggest signs from our checked catalogue.',
  },
  {
    icon: 'shield',
    title: 'No ads, no tracking, no selling',
    body: 'No advertising, analytics trackers or third-party cookies, and fonts are served from this site. We will never sell your data.',
  },
];

export default function Privacy() {
  useTitle('Privacy & ethics');
  return (
    <div className="prose-page">
      <header className="prose-hero">
        <div className="container narrow">
          <p className="eyebrow">Privacy &amp; ethics</p>
          <h1>Plain-language promises.</h1>
          <p className="lede">
            Signsprout is used by families, often in the first, tender months after learning their baby is deaf. That
            deserves care, so here is exactly what we collect, and what we believe.
          </p>
        </div>
      </header>

      <div className="container narrow">
        <ul className="promise-list">
          {PROMISES.map((p) => (
            <li key={p.title} className="promise">
              <span className="promise-icon">
                <Icon name={p.icon} size={22} />
              </span>
              <div>
                <h2>{p.title}</h2>
                <p>{p.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <section className="prose" aria-labelledby="ethics-t">
          <h2 id="ethics-t">How we approach ASL</h2>
          <p>
            American Sign Language is a complete language with its own grammar, poetry and history, and it belongs to
            the Deaf community. Signsprout is a practice tool for first ASL vocabulary, not a teacher, and we try to act
            like one:
          </p>
          <ul>
            <li>
              <strong>A learning aid, not a translator.</strong> We never claim to interpret or translate. This site
              links to Deaf-led resources, family organisations, the SKI-HI Deaf Mentor program and Gallaudet’s ASL
              Connect.
            </li>
            <li>
              <strong>Honest scoring.</strong> We check handshape, then place, then movement, then the final handshape.
              Facial grammar, mouthing and body shifts are essential to ASL but can’t be seen by hand tracking, so
              they’re mentioned as tips, not scored. For fingerspelled letters that hand tracking confuses (such as M,
              N, T, E, A, S), Signsprout is lenient and says so.
            </li>
            <li>
              <strong>Compared signs, credited sources.</strong> We compared each sign with Handspeak (Jolanta Lapiak)
              and Lifeprint / ASL University (Dr. Bill Vicars). No Deaf signer has reviewed Signsprout yet; paid review
              by Deaf signers comes before launch. Each dictionary page links its references, and our descriptions are
              our own.
            </li>
            <li>
              <strong>Variants are valid.</strong> Signs differ between regions and families. Common variants are
              listed; for now the checker accepts one form.
            </li>
            <li>
              <strong>Language choice is the family’s.</strong> Many families use hearing technology and spoken language
              too. We see signing as additive, never either-or.
            </li>
          </ul>
          <h2>What’s next</h2>
          <p>
            Our plan is Deaf co-leadership of the content, with pay and a veto over what Signsprout teaches. That isn’t
            in place yet. Before launch, Deaf signers will be paid to review every sign. We also plan paid Deaf teachers
            inside the app and fair pay for any Deaf signer whose work we use. If we ever collect data to improve
            recognition, it will be opt-in, revocable, hand-joints only, and governed with the Deaf community.
          </p>
          <h2>Questions or requests</h2>
          <p>
            Deleting your account removes all of your synced progress and share links; your headset keeps its own local
            copy until you clear it. Signsprout is made by {AUTHOR}.
          </p>
          <p className="prose-back">
            <Link className="link" to="/">
              <Icon name="arrowLeft" size={16} /> Back to Signsprout
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
