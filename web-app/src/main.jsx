import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Altos del Parque UI Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#161616',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'var(--cds-font-sans)'
        }}>
          <div style={{
            maxWidth: '640px',
            width: '100%',
            backgroundColor: '#262626',
            border: '1px solid #da1e28',
            padding: '32px'
          }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#fa4d56', fontWeight: 600, marginBottom: '8px' }}>
              CRITICAL RUNTIME RECOVERY // ALTOS DEL PARQUE
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>
              Excepción de Interfaz Detectada
            </h1>
            <p style={{ fontSize: '13px', color: '#c6c6c6', lineHeight: 1.5, marginBottom: '20px' }}>
              Se ha interceptado una excepción en el árbol de renderizado. Puedes reiniciar el almacenamiento local y recargar el sistema operativo del conjunto.
            </p>
            <div style={{
              backgroundColor: '#161616',
              border: '1px solid #393939',
              padding: '12px',
              fontFamily: 'var(--cds-font-mono)',
              fontSize: '12px',
              color: '#ff8389',
              marginBottom: '24px',
              overflowX: 'auto'
            }}>
              {this.state.error?.message || String(this.state.error)}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.clear(); } catch (_) {}
                  window.location.reload();
                }}
                className="cds-btn cds-btn-primary"
              >
                Limpiar Caché Local y Recargar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="cds-btn cds-btn-secondary"
              >
                Recargar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
