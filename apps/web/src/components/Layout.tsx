import { Suspense, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';
import { PageLoader } from './PageLoader';

const INK_ROUTES = ['/', '/pair'];

export function Layout() {
  const location = useLocation();
  const tone = INK_ROUTES.includes(location.pathname) ? 'ink' : 'paper';

  // New page → start at the top (landing handles its own ?s=section scrolling).
  useEffect(() => {
    if (!new URLSearchParams(location.search).get('s'))
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.getElementById('main');
    main?.focus();
    main?.scrollIntoView();
  };

  return (
    <>
      <a className="skip-link" href="#main" onClick={skip}>
        Skip to content
      </a>
      <Header tone={tone} />
      <main id="main" tabIndex={-1} className={`page page-${tone}`}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
