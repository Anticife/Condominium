import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  History,
  PlayCircle,
  Search,
  X,
} from 'lucide-react';
import { db } from '../../config/firebase';
import { PQRS_CATEGORIES, subscribeToPqrsHistory } from '../../services/pqrsService';
import { formatDateTimeCO } from '../../services/dateUtils';

const CATEGORY_LABELS = {
  Peticion: 'Petición',
  Queja: 'Queja',
  Reclamo: 'Reclamo',
  Sugerencia: 'Sugerencia',
};

const STATUS_TAG_CLASS = {
  Radicada: 'cds-tag-blue',
  'En gestión': 'cds-tag-yellow',
  Resuelta: 'cds-tag-green',
};

export default function AdminPqrsTab({
  condoId,
  pqrs = [],
  onTransitionPqrs,
  onNotify,
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Resolve Modal (RN-B6)
  const [resolvingTicket, setResolvingTicket] = useState(null);
  const [officialResponse, setOfficialResponse] = useState('');

  // Audit History Modal
  const [historyTicket, setHistoryTicket] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoadedId, setHistoryLoadedId] = useState(null);
  const historyLoading = Boolean(historyTicket?.id && historyLoadedId !== historyTicket.id);

  useEffect(() => {
    if (!historyTicket?.id) return undefined;
    const ticketId = historyTicket.id;
    const unsub = subscribeToPqrsHistory(
      db,
      condoId,
      ticketId,
      (entries) => {
        setHistoryEntries(entries);
        setHistoryLoadedId(ticketId);
      },
      (err) => {
        setHistoryLoadedId(ticketId);
        onNotify?.('error', err?.message || 'No se pudo cargar el historial de auditoría.');
      },
    );
    return () => unsub();
  }, [condoId, historyTicket?.id, onNotify]);

  const radicadaCount = pqrs.filter((t) => t.status === 'Radicada').length;
  const inProgressCount = pqrs.filter((t) => t.status === 'En gestión').length;
  const resolvedCount = pqrs.filter((t) => t.status === 'Resuelta').length;
  const resolutionRate = pqrs.length > 0 ? Math.round((resolvedCount / pqrs.length) * 100) : 0;

  const filteredTickets = pqrs.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        (t.ticketNumber || '').toLowerCase().includes(q) ||
        (t.apartmentId || '').toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleTakeInProgress = async (ticket) => {
    setBusyId(ticket.id);
    try {
      await onTransitionPqrs({
        pqrsId: ticket.id,
        newStatus: 'En gestión',
        comment: 'PQRS tomada en gestión por Administración.',
      });
    } catch (err) {
      onNotify?.('error', err?.message || 'No se pudo pasar la PQRS a En gestión.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!resolvingTicket) return;
    const trimmed = officialResponse.trim();
    if (trimmed.length < 10) {
      onNotify?.('error', 'La respuesta oficial debe tener mínimo 10 caracteres (RN-B6).');
      return;
    }
    setBusyId(resolvingTicket.id);
    try {
      await onTransitionPqrs({
        pqrsId: resolvingTicket.id,
        newStatus: 'Resuelta',
        officialResponse: trimmed,
        comment: trimmed,
      });
      setResolvingTicket(null);
      setOfficialResponse('');
    } catch (err) {
      onNotify?.('error', err?.message || 'No se pudo resolver la PQRS.');
    } finally {
      setBusyId(null);
    }
  };

  const trimmedLen = officialResponse.trim().length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & KPI Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#161616' }}>
            Bandeja Oficial de PQRS ({pqrs.length})
          </h2>
          <p style={{ fontSize: '13px', color: '#525252', marginTop: '4px' }}>
            Gestión con radicado consecutivo, respuesta oficial obligatoria (mín. 10 caracteres, RN-B6) e historial inmutable de auditoría.
          </p>
        </div>
        <span className="cds-tag cds-tag-dark font-mono">
          TASA DE RESOLUCIÓN: {resolutionRate}% ({resolvedCount}/{pqrs.length})
        </span>
      </div>

      {/* Filters Bar */}
      <div
        className="cds-tile"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `Todas (${pqrs.length})` },
            { id: 'Radicada', label: `Radicadas (${radicadaCount})` },
            { id: 'En gestión', label: `En gestión (${inProgressCount})` },
            { id: 'Resuelta', label: `Resueltas (${resolvedCount})` },
          ].map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  backgroundColor: active ? '#161616' : '#f4f4f4',
                  color: active ? '#ffffff' : '#161616',
                  border: '1px solid #8d8d8d',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Filtrar por categoría PQRS"
            className="cds-select"
            style={{ width: '165px', height: '36px', fontSize: '13px' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">Todas las categorías</option>
            {PQRS_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>

          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search
              size={15}
              color="#525252"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="cds-input"
              style={{ height: '36px', paddingLeft: '32px', fontSize: '13px' }}
              placeholder="Buscar radicado, apto o asunto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* PQRS Table */}
      <div className="cds-table-container">
        <table className="cds-table">
          <thead>
            <tr>
              <th>Radicado</th>
              <th>Unidad</th>
              <th>Categoría</th>
              <th>Asunto y Descripción</th>
              <th>Estado</th>
              <th>Radicación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#525252' }}>
                  <FileText size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.45 }} />
                  No hay solicitudes PQRS que coincidan con los filtros actuales.
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => {
                const isBusy = busyId === ticket.id;
                return (
                  <tr key={ticket.id}>
                    <td className="font-mono" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {ticket.ticketNumber}
                    </td>
                    <td>
                      <span className="cds-tag cds-tag-dark">{ticket.apartmentId}</span>
                    </td>
                    <td>
                      <span className="cds-tag cds-tag-gray">
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </span>
                    </td>
                    <td style={{ maxWidth: '360px' }}>
                      <div style={{ fontWeight: 600, color: '#161616' }}>{ticket.subject}</div>
                      <div style={{ fontSize: '12px', color: '#525252', marginTop: '2px', lineHeight: 1.4 }}>
                        {ticket.description}
                      </div>
                      {ticket.officialResponse && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '8px 10px',
                            backgroundColor: '#defbe6',
                            border: '1px solid #6fdc8c',
                            fontSize: '12px',
                            color: '#0e6027',
                          }}
                        >
                          <strong>Respuesta oficial:</strong> {ticket.officialResponse}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`cds-tag ${STATUS_TAG_CLASS[ticket.status] || 'cds-tag-gray'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '12px', whiteSpace: 'nowrap', color: '#525252' }}>
                      {formatDateTimeCO(ticket.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {ticket.status === 'Radicada' && (
                          <button
                            type="button"
                            className="cds-btn cds-btn-secondary"
                            style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                            disabled={isBusy}
                            onClick={() => handleTakeInProgress(ticket)}
                          >
                            <PlayCircle size={14} />
                            <span>{isBusy ? 'Actualizando...' : 'En gestión'}</span>
                          </button>
                        )}
                        {ticket.status !== 'Resuelta' && (
                          <button
                            type="button"
                            className="cds-btn cds-btn-primary"
                            style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                            disabled={isBusy}
                            onClick={() => {
                              setResolvingTicket(ticket);
                              setOfficialResponse('');
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Resolver</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="cds-btn cds-btn-ghost"
                          style={{
                            height: '30px',
                            minHeight: '30px',
                            padding: '0 10px',
                            fontSize: '12px',
                            border: '1px solid #e0e0e0',
                          }}
                          onClick={() => setHistoryTicket(ticket)}
                        >
                          <History size={14} />
                          <span>Historial</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Resolver PQRS con Respuesta Oficial (RN-B6) */}
      {resolvingTicket && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content" style={{ maxWidth: '620px' }}>
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
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                Resolver {resolvingTicket.ticketNumber} — Unidad {resolvingTicket.apartmentId}
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de resolución"
                onClick={() => setResolvingTicket(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmResolve}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f4f4f4', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#161616' }}>
                    {resolvingTicket.subject}
                  </div>
                  <div style={{ fontSize: '12px', color: '#525252', marginTop: '4px' }}>
                    {resolvingTicket.description}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label htmlFor="pqrs-official-response" className="cds-input-label" style={{ marginBottom: 0 }}>
                      RESPUESTA OFICIAL AL RESIDENTE (OBLIGATORIA, MÍN. 10 CARACTERES — RN-B6)
                    </label>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: trimmedLen >= 10 ? '#0e6027' : '#a2191f',
                      }}
                    >
                      {trimmedLen}/10 mín.
                    </span>
                  </div>
                  <textarea
                    id="pqrs-official-response"
                    className="cds-input"
                    rows={4}
                    style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
                    placeholder="Redacte la respuesta oficial motivada que quedará registrada en el expediente inmutable..."
                    value={officialResponse}
                    onChange={(e) => setOfficialResponse(e.target.value)}
                    required
                  />
                </div>
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
                <button
                  type="button"
                  className="cds-btn cds-btn-secondary"
                  onClick={() => setResolvingTicket(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cds-btn cds-btn-primary"
                  disabled={busyId === resolvingTicket.id || trimmedLen < 10}
                >
                  <CheckCircle2 size={15} />
                  <span>{busyId === resolvingTicket.id ? 'Registrando...' : 'Emitir Respuesta Oficial'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Historial Inmutable de Auditoría */}
      {historyTicket && (
        <div className="cds-modal-overlay">
          <div className="cds-modal-content" style={{ maxWidth: '620px' }}>
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
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                Historial de Auditoría — {historyTicket.ticketNumber}
              </div>
              <button
                type="button"
                aria-label="Cerrar historial"
                onClick={() => setHistoryTicket(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '14px', fontSize: '13px', color: '#525252' }}>
                Unidad <strong className="font-mono">{historyTicket.apartmentId}</strong> •{' '}
                <strong>{historyTicket.subject}</strong>
              </div>

              {historyLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#525252', fontSize: '13px' }}>
                  Cargando trazabilidad desde Firestore...
                </div>
              ) : historyEntries.length === 0 ? (
                <div style={{ padding: '20px', backgroundColor: '#f4f4f4', border: '1px solid #e0e0e0', fontSize: '13px', color: '#525252' }}>
                  Esta PQRS aún no tiene transiciones de estado registradas. Radicada el {formatDateTimeCO(historyTicket.createdAt)}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`cds-tag ${STATUS_TAG_CLASS[entry.previousStatus] || 'cds-tag-gray'}`}>
                            {entry.previousStatus}
                          </span>
                          <span style={{ color: '#525252', fontSize: '12px' }}>→</span>
                          <span className={`cds-tag ${STATUS_TAG_CLASS[entry.newStatus] || 'cds-tag-gray'}`}>
                            {entry.newStatus}
                          </span>
                        </div>
                        <span className="font-mono" style={{ fontSize: '11px', color: '#525252', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {formatDateTimeCO(entry.changedAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#161616', marginTop: '8px' }}>
                        {entry.comment}
                      </div>
                    </div>
                  ))}
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
              }}
            >
              <button
                type="button"
                className="cds-btn cds-btn-secondary"
                onClick={() => setHistoryTicket(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
