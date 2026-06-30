import { createRoot } from 'react-dom/client';
import App from './App';
import { installVisibilityTicker } from './game/ticker';
import './spec'; // deep-freezes the spec at load (presets/code can only overlay it)
import './styles/globals.css';
import './ui/ui.css';

installVisibilityTicker();

// NOTE: no <StrictMode> on purpose — it double-invokes effects in dev, which
// would init the Pixi Application twice. The renderer is a single imperative
// instance guarded in StageCanvas.
createRoot(document.getElementById('root')!).render(<App />);
