import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, X, ArrowRight } from 'lucide-react';

export default function CensusUploadModal({ isOpen, onClose, onConfirmSeed }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [validationStats, setValidationStats] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSimulateFileSelect = () => {
    setSelectedFile({
      name: 'censo_altos_del_parque_2026.xlsx',
      size: '48.2 KB',
      sheetCount: 3
    });

    // Generate preview rows (representing the 3 towers)
    const preview = [
      { id: 'T1-101', tower: 'Torre 1', number: '101', owner: 'Carlos Rodríguez', doc: '1020445890', valid: true },
      { id: 'T1-102', tower: 'Torre 1', number: '102', owner: 'María Gómez', doc: '1020445891', valid: true },
      { id: 'T1-103', tower: 'Torre 1', number: '103', owner: 'Andrés Martínez', doc: '1020445892', valid: true },
      { id: 'T2-201', tower: 'Torre 2', number: '201', owner: 'Laura López', doc: '1020445900', valid: true },
      { id: 'T2-202', tower: 'Torre 2', number: '202', owner: 'Felipe González', doc: '1020445901', valid: true },
      { id: 'T3-501', tower: 'Torre 3', number: '501', owner: 'Valentina Pérez', doc: '1020446010', valid: true }
    ];

    setParsedRows(preview);
    setValidationStats({
      total: 240,
      valid: 240,
      errors: 0,
      towers: 3,
      duplicates: 0
    });
  };

  const handleExecuteUpload = async () => {
    setIsProcessing(true);
    await onConfirmSeed();
    setIsProcessing(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(22, 22, 22, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      fontFamily: 'var(--cds-font-sans)'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '680px',
        border: '1px solid #161616',
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#161616',
          color: '#ffffff',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #0f62fe'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--cds-font-mono)', color: '#78a9ff' }}>
              CON-13 // IMPORTADOR MASIVO (SCRUM-44)
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '2px 0 0 0' }}>
              Carga Masiva de Censo Inmobiliario & Previsualización
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#c6c6c6', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {!selectedFile ? (
            <div 
              onClick={handleSimulateFileSelect}
              style={{
                border: '2px dashed #8d8d8d',
                backgroundColor: '#f4f4f4',
                padding: '36px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0f62fe';
                e.currentTarget.style.backgroundColor = '#edf5ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#8d8d8d';
                e.currentTarget.style.backgroundColor = '#f4f4f4';
              }}
            >
              <UploadCloud size={40} color="#0f62fe" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#161616', marginBottom: '4px' }}>
                Haga clic para cargar la plantilla de Censo Inmobiliario
              </div>
              <div style={{ fontSize: '12px', color: '#525252' }}>
                Archivos compatibles: .XLSX, .XLS o .CSV (hasta 10 MB)
              </div>
              <div style={{ marginTop: '12px', fontSize: '11px', fontFamily: 'var(--cds-font-mono)', color: '#0f62fe' }}>
                [Simular Carga de 'censo_altos_del_parque_2026.xlsx']
              </div>
            </div>
          ) : (
            <div>
              {/* File Info Card */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f4f4f4',
                border: '1px solid #e0e0e0',
                padding: '12px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileSpreadsheet size={24} color="#0f62fe" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: '11px', color: '#525252' }}>Tamaño: {selectedFile.size} • Hojas procesadas: {selectedFile.sheetCount}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  style={{ background: 'none', border: 'none', color: '#da1e28', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Validation Summary */}
              {validationStats && (
                <div style={{
                  backgroundColor: '#defbe6',
                  border: '1px solid #6fdc8c',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#0e6027'
                }}>
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Previsualización exitosa (CON-02 / CON-13):</strong> Se verificaron {validationStats.total} unidades en {validationStats.towers} torres sin errores de sintaxis ni apartamentos duplicados.
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Muestra de Datos a Escribir en Firestore (writeBatch):
                </div>
                <div className="cds-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="cds-table">
                    <thead>
                      <tr>
                        <th>Código Apto</th>
                        <th>Torre</th>
                        <th>Propietario</th>
                        <th>Documento</th>
                        <th>Estado Regla</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map(r => (
                        <tr key={r.id}>
                          <td className="font-mono">{r.id}</td>
                          <td>{r.tower}</td>
                          <td>{r.owner}</td>
                          <td className="font-mono">{r.doc}</td>
                          <td><span className="cds-tag cds-tag-green">Válido</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f4f4f4',
          borderTop: '1px solid #e0e0e0',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            className="cds-btn cds-btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="cds-btn cds-btn-primary"
            disabled={!selectedFile || isProcessing}
            onClick={handleExecuteUpload}
          >
            <span>{isProcessing ? 'Sincronizando Firestore...' : 'Confirmar e Iniciar writeBatch'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
