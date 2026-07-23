import './motionOverride'; // MUST stay first — neutralizes prefers-reduced-motion before any module reads it
import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { App } from './App';

/** PREVIEW STABILITY (Noski): a runtime crash must NEVER leave a dead white
 *  screen. The boundary catches render/lifecycle errors and reloads the page
 *  once automatically (2s, so the console error is still visible); if it
 *  crashes again within 30s it shows a reload button instead of looping. */
class CrashGuard extends Component<{ children: ReactNode }, { crashed: boolean; looping: boolean }> {
  state = { crashed: false, looping: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[CrashGuard] runtime crash:', error);
    const last = Number(sessionStorage.getItem('crash-guard-ts') || '0');
    const now = Date.now();
    sessionStorage.setItem('crash-guard-ts', String(now));
    if (now - last < 30_000) {
      this.setState({ looping: true }); // second crash in a row — stop auto-reloading
      return;
    }
    setTimeout(() => window.location.reload(), 2000);
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 16, background: '#0b0714', color: '#ffe9a8',
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
      }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          {this.state.looping ? 'Slot crashed twice — check the console.' : 'Slot crashed — reloading…'}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 26px', borderRadius: 12, border: '2px solid #f7b733', cursor: 'pointer',
            background: 'linear-gradient(180deg,#ffd75e,#f7a733)', color: '#221302', fontWeight: 900,
          }}
        >RELOAD</button>
      </div>
    );
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');

createRoot(root).render(
  <StrictMode>
    <CrashGuard>
      <App />
    </CrashGuard>
  </StrictMode>,
);
