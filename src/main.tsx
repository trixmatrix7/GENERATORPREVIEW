import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installVisibilityTicker } from '@/studio/visibilityTicker';
import '@/styles/globals.css';

installVisibilityTicker(); // preview-only: keep GSAP running in hidden tabs

// StrictMode stays on — PixiApp handles the double-mount internally (init
// yields a microtask and bails if destroy() ran during the yield).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
