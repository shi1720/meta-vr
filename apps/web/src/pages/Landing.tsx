import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Hero } from '../components/landing/Hero';
import {
  Faq,
  Features,
  FinalCta,
  HowItWorks,
  Pricing,
  Responsible,
  Science,
  Sources,
  Why,
} from '../components/landing/Sections';
import { useTitle } from '../lib/hooks';
import '../styles/landing.css';

export default function Landing() {
  useTitle('');
  const location = useLocation();

  // /?s=how scrolls to a section (hash anchors are taken by the router).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('s');
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    let cancelled = false;
    const firstLoad = location.key === 'default';
    const go = () => {
      if (cancelled) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Jump straight there on a fresh page load; glide when navigating within the site.
      el.scrollIntoView({ behavior: reduced || firstLoad ? 'instant' : 'smooth' });
      const heading = el.querySelector<HTMLElement>('h2');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    };
    // Wait for web fonts so the section doesn't move after we've scrolled to it.
    const ready = document.fonts?.ready ?? Promise.resolve();
    void ready.then(() => requestAnimationFrame(go));
    return () => {
      cancelled = true;
    };
  }, [location.key, location.search]);

  return (
    <>
      <Hero />
      <Why />
      <HowItWorks />
      <Science />
      <Features />
      <Pricing />
      <Responsible />
      <Faq />
      <FinalCta />
      <Sources />
    </>
  );
}
