import { Link } from 'react-router-dom';
import { useTitle } from '../lib/hooks';
import { Icon } from '../components/Icon';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <div className="container narrow not-found">
      <p className="eyebrow">404</p>
      <h1>This page hasn’t sprouted.</h1>
      <p className="lede">The link may be old, or the page may have moved.</p>
      <div className="hero-ctas">
        <Link className="btn btn-primary" to="/">
          <Icon name="arrowLeft" size={18} />
          Back home
        </Link>
        <Link className="btn btn-ghost" to="/dictionary">
          Browse the dictionary
        </Link>
      </div>
    </div>
  );
}
