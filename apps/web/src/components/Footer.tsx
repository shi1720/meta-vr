import { Link } from 'react-router-dom';
import { APP_URL, AUTHOR, DEMO_URL } from '../lib/config';
import { COUNTS } from '../lib/catalog';
import { Wordmark } from './Logo';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer on-ink">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Wordmark size={40} />
          <p className="muted">
            Learn your first ASL signs with your own two hands: glowing guide hands, per-finger feedback and a garden
            that grows with every sign.
          </p>
          <p className="footer-credit">
            Made by <strong>{AUTHOR}</strong>
            <span aria-hidden="true"> · </span>
            <span className="muted">Meta VR Start Developer Competition 2026</span>
          </p>
        </div>
        <nav className="footer-col" aria-label="Product">
          <h2>Product</h2>
          <a href={APP_URL}>Start on Meta Quest</a>
          <a href={DEMO_URL}>Watch it in your browser</a>
          <Link to="/dictionary">Sign dictionary ({COUNTS.total})</Link>
          <Link to="/pair">Pair a headset</Link>
          <Link to="/dashboard">Family dashboard</Link>
        </nav>
        <nav className="footer-col" aria-label="About">
          <h2>About</h2>
          <Link to="/?s=how">How it works</Link>
          <Link to="/?s=science">The science</Link>
          <Link to="/?s=responsible">Built responsibly</Link>
          <Link to="/privacy">Privacy &amp; ethics</Link>
        </nav>
        <nav className="footer-col" aria-label="ASL and family resources">
          <h2>Keep learning</h2>
          <a href="https://www.handspeak.com/" target="_blank" rel="noreferrer">
            Handspeak
          </a>
          <a href="https://www.lifeprint.com/" target="_blank" rel="noreferrer">
            Lifeprint / ASL University
          </a>
          <a href="https://deafchildren.org/" target="_blank" rel="noreferrer">
            American Society for Deaf Children
          </a>
          <a href="https://handsandvoices.org/" target="_blank" rel="noreferrer">
            Hands &amp; Voices
          </a>
          <a
            href="https://idrpp.usu.edu/projects/ski-hi/deaf-hard-of-hearing/deaf-mentors"
            target="_blank"
            rel="noreferrer"
          >
            SKI-HI Deaf Mentor program
          </a>
          <a href="https://www.gallaudet.edu/asl-connect/" target="_blank" rel="noreferrer">
            Gallaudet ASL Connect
          </a>
        </nav>
      </div>
      <div className="container footer-bottom">
        <p className="muted">
          © {year} Signsprout. A learning aid, not a translator. Signsprout is an independent project and is not
          affiliated with Meta.
        </p>
        <p className="muted">Hand models: WebXR Input Profiles (MIT).</p>
      </div>
    </footer>
  );
}
