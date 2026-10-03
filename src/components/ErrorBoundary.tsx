import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { flushPersistedState } from '../lib/persistStorage';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Route-level safety net: a render error shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  private clearCanvas = () => {
    // Saved diagrams stay; only the working canvas (the likely cause) is cleared.
    useDiagramStore.setState({ nodes: [], edges: [], analysisResults: [], analysisMeta: null, isDirty: false });
    flushPersistedState();
    window.location.assign('/playground');
  };

  render() {
    if (!this.state.error) return this.props.children;
    const button: React.CSSProperties = {
      padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
      fontFamily: "'Space Grotesk', sans-serif",
    };
    return (
      <div role="alert" style={{
        height: '100%', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: 'var(--bg-base)',
      }}>
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, color: 'var(--text-strong)' }}>
          Something went wrong
        </h2>
        <p style={{ margin: 0, maxWidth: 420, fontSize: 15, lineHeight: 1.6, color: 'var(--text-muted)' }}>
          This page hit an unexpected error. Reload to try again. If it keeps happening, clear the
          canvas: your saved diagrams are kept.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={() => window.location.reload()}
            style={{ ...button, background: 'var(--accent-strong)', color: 'var(--on-accent)', border: 'none' }}>
            Reload
          </button>
          <button type="button" onClick={this.clearCanvas}
            style={{ ...button, background: 'transparent', color: 'var(--text-strong)', border: '1px solid var(--border)' }}>
            Clear canvas and reload
          </button>
        </div>
      </div>
    );
  }
}
