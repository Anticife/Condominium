import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { db } from '../../config/firebase';
import {
  importCensusBatch,
  parseCensusCsv,
} from '../../services/censusImporter';

const CSV_TEMPLATE = [
  'Torre,Apartamento,NombreResidente,Email,Telefono,EsPropietario',
  'T1,101,Carlos Andrés Pérez,carlos.perez@ejemplo.co,3001234567,Si',
  'T1,102,María Fernanda Gómez,maria.gomez@ejemplo.co,3102345678,No',
  'T2,201,Andrés Felipe Ruiz,andres.ruiz@ejemplo.co,3203456789,Si',
].join('\n');

export default function CensusImportModal({ isOpen, onClose, condoId, onNotify }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);

  if (!isOpen) return null;

  const resetState = () => {
    setCsvText('');
    setFileName('');
    setParsed(null);
    setParseError(null);
    setReport(null);
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_censo_copropiedad.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleValidateText = (text) => {
    setCsvText(text);
    setReport(null);
    setParseError(null);
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    try {
      const result = parseCensusCsv(text);
      setParsed(result);
    } catch (err) {
      setParsed(null);
      setParseError(err?.message || 'No se pudo validar el contenido CSV.');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    handleValidateText(text);
  };

  const handleExecuteImport = async () => {
    if (!parsed || parsed.validRows.length === 0) return;
    setImporting(true);
    setParseError(null);
    try {
      const batchReport = await importCensusBatch(db, condoId, parsed.validRows);
      const mergedReport = {
        ...batchReport,
        errors: [...parsed.errors, ...batchReport.errors],
      };
      setReport(mergedReport);
      onNotify?.(
        'success',
        `Importación completada: ${mergedReport.apartmentsCreated} unidades creadas en ${mergedReport.batchesCommitted} lote(s).`,
      );
    } catch (err) {
      const msg = err?.message || 'Error ejecutando la importación masiva en Firestore.';
      setParseError(msg);
      onNotify?.('error', msg);
    } finally {
      setImporting(false);
    }
  };

  const distinctTowers = parsed
    ? Array.from(new Set(parsed.validRows.map((r) => r.towerId)))
    : [];

  return (
    <div className="cds-modal-overlay">
      <div
        className="cds-modal-content"
        style={{ maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div
          style={{
            backgroundColor: '#161616',
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600 }}>
            <FileSpreadsheet size={18} color="#78a9ff" />
            <span>Importación Masiva de Censo CSV (RF-04)</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar importador de censo"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Template & Upload Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 14px',
              backgroundColor: '#f4f4f4',
              border: '1px solid #e0e0e0',
            }}
          >
            <div style={{ fontSize: '12px', color: '#525252' }}>
              Columnas esperadas:{' '}
              <span className="font-mono" style={{ color: '#161616', fontWeight: 600 }}>
                Torre, Apartamento, NombreResidente, Email, Telefono, EsPropietario
              </span>
              <div>Acepta separador coma (,) o punto y coma (;). Lotes atómicos de hasta 400 operaciones.</div>
            </div>
            <button
              type="button"
              className="cds-btn cds-btn-secondary"
              style={{ height: '34px', minHeight: '34px', fontSize: '12px' }}
              onClick={handleDownloadTemplate}
            >
              <Download size={14} />
              <span>Descargar Plantilla CSV</span>
            </button>
          </div>

          {/* File Picker + Paste Box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div>
              <label htmlFor="census-csv-file" className="cds-input-label">
                SUBIR ARCHIVO CSV DESDE EXCEL / GOOGLE SHEETS
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label
                  htmlFor="census-csv-file"
                  className="cds-btn cds-btn-primary"
                  style={{ height: '36px', minHeight: '36px', fontSize: '12px', cursor: 'pointer' }}
                >
                  <Upload size={14} />
                  <span>Seleccionar archivo .csv</span>
                </label>
                <input
                  id="census-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {fileName && (
                  <span className="cds-tag cds-tag-blue font-mono">{fileName}</span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="census-csv-text" className="cds-input-label">
                O PEGAR CONTENIDO CSV DIRECTAMENTE
              </label>
              <textarea
                id="census-csv-text"
                className="cds-input font-mono"
                rows={4}
                style={{ height: 'auto', padding: '10px 12px', fontSize: '12px', resize: 'vertical' }}
                placeholder={CSV_TEMPLATE}
                value={csvText}
                onChange={(e) => handleValidateText(e.target.value)}
              />
            </div>
          </div>

          {parseError && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fff1f1',
                border: '1px solid #ffb3b8',
                color: '#a2191f',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{parseError}</span>
            </div>
          )}

          {/* Validation Preview */}
          {parsed && !report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="cds-form-row-3">
                <div style={{ padding: '10px 12px', backgroundColor: '#defbe6', border: '1px solid #6fdc8c' }}>
                  <div style={{ fontSize: '11px', color: '#0e6027', fontWeight: 600 }}>FILAS VÁLIDAS</div>
                  <div className="font-mono" style={{ fontSize: '20px', fontWeight: 600, color: '#0e6027' }}>
                    {parsed.validRows.length}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: '#edf5ff', border: '1px solid #a6c8ff' }}>
                  <div style={{ fontSize: '11px', color: '#0043ce', fontWeight: 600 }}>TORRES DETECTADAS</div>
                  <div className="font-mono" style={{ fontSize: '20px', fontWeight: 600, color: '#0043ce' }}>
                    {distinctTowers.length}
                  </div>
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: parsed.errors.length > 0 ? '#fff1f1' : '#f4f4f4',
                    border: `1px solid ${parsed.errors.length > 0 ? '#ffb3b8' : '#e0e0e0'}`,
                  }}
                >
                  <div style={{ fontSize: '11px', color: parsed.errors.length > 0 ? '#a2191f' : '#525252', fontWeight: 600 }}>
                    FILAS CON ERROR (OMITIDAS)
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: '20px', fontWeight: 600, color: parsed.errors.length > 0 ? '#a2191f' : '#161616' }}
                  >
                    {parsed.errors.length}
                  </div>
                </div>
              </div>

              {parsed.errors.length > 0 && (
                <div className="cds-table-container" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  <table className="cds-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Motivo de validación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.errors.map((err, idx) => (
                        <tr key={`${err.rowNumber}-${idx}`}>
                          <td className="font-mono" style={{ fontWeight: 600 }}>#{err.rowNumber}</td>
                          <td style={{ color: '#a2191f', fontSize: '12px' }}>{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {parsed.validRows.length > 0 && (
                <div className="cds-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="cds-table">
                    <thead>
                      <tr>
                        <th>Unidad</th>
                        <th>Torre</th>
                        <th>Titular / Residente</th>
                        <th>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.validRows.slice(0, 25).map((row) => (
                        <tr key={row.apartmentId}>
                          <td className="font-mono" style={{ fontWeight: 600 }}>{row.apartmentId}</td>
                          <td className="font-mono">{row.towerId}</td>
                          <td>{row.residentName}</td>
                          <td>
                            <span className={`cds-tag ${row.isOwner ? 'cds-tag-blue' : 'cds-tag-gray'}`}>
                              {row.isOwner ? 'Propietario' : 'Arrendatario'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.validRows.length > 25 && (
                    <div style={{ padding: '8px 12px', fontSize: '12px', color: '#525252', backgroundColor: '#f4f4f4' }}>
                      Mostrando las primeras 25 de {parsed.validRows.length} unidades válidas.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Post-Import Report */}
          {report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#defbe6',
                  border: '1px solid #6fdc8c',
                  color: '#0e6027',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                }}
              >
                <CheckCircle2 size={18} />
                <div>
                  <strong>Carga masiva finalizada en Cloud Firestore.</strong>{' '}
                  {report.apartmentsCreated} unidades creadas, {report.towersProcessed} torres procesadas,{' '}
                  {report.batchesCommitted} lote(s) confirmados y {report.skippedDuplicates} duplicado(s) omitido(s).
                </div>
              </div>

              {report.errors.length > 0 && (
                <div className="cds-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="cds-table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Observación / Duplicado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.errors.map((err, idx) => (
                        <tr key={`${err.rowNumber}-${idx}`}>
                          <td className="font-mono">#{err.rowNumber}</td>
                          <td style={{ fontSize: '12px', color: '#525252' }}>{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            backgroundColor: '#f4f4f4',
            borderTop: '1px solid #e0e0e0',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button type="button" className="cds-btn cds-btn-secondary" onClick={handleClose} disabled={importing}>
            {report ? 'Finalizar' : 'Cancelar'}
          </button>
          {!report && (
            <button
              type="button"
              className="cds-btn cds-btn-primary"
              disabled={importing || !parsed || parsed.validRows.length === 0}
              onClick={handleExecuteImport}
            >
              <Upload size={15} />
              <span>
                {importing
                  ? 'Importando en Firestore...'
                  : `Importar ${parsed?.validRows.length || 0} Unidades`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
