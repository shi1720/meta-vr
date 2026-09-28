import { lazy } from 'react';
import { createHashRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import Landing from './pages/Landing';

// Landing is eager (first paint); everything else streams in on demand.
const Dictionary = lazy(() => import('./pages/Dictionary'));
const SignDetail = lazy(() => import('./pages/SignDetail'));
const Pair = lazy(() => import('./pages/Pair'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Share = lazy(() => import('./pages/Share'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * Hash routing (/#/dictionary/hello) so the site works on any static host,
 * including GitHub Pages sub-paths, with no rewrite rules.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'dictionary', element: <Dictionary /> },
      { path: 'dictionary/:id', element: <SignDetail /> },
      { path: 'pair', element: <Pair /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'share/:token', element: <Share /> },
      { path: 'privacy', element: <Privacy /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
