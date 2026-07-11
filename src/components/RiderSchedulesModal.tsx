"use client";

import React from 'react';
import { X, Calendar, Trash2, Search } from 'lucide-react';
import { User, Schedule, Establishment } from '../utils/db';

interface RiderSchedulesModalProps {
  riderId: string | null;
  onClose: () => void;
  riders: User[];
  schedules: Schedule[];
  establishments: Establishment[];
  modalHistoryEst: string;
  setModalHistoryEst: (val: string) => void;
  modalHistoryFrom: string;
  setModalHistoryFrom: (val: string) => void;
  modalHistoryTo: string;
  setModalHistoryTo: (val: string) => void;
  onCancelSchedule: (id: string) => void;
  onNewSchedule: (riderId: string) => void;
  getShiftLabel: (shift: string) => string;
}

export default function RiderSchedulesModal({
  riderId,
  onClose,
  riders,
  schedules,
  establishments,
  modalHistoryEst,
  setModalHistoryEst,
  modalHistoryFrom,
  setModalHistoryFrom,
  modalHistoryTo,
  setModalHistoryTo,
  onCancelSchedule,
  onNewSchedule,
  getShiftLabel
}: RiderSchedulesModalProps) {
  if (!riderId) return null;

  const rider = riders.find(r => r.id === riderId);
  if (!rider) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const rs = schedules.filter(s => s.riderId === rider.id).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = rs.filter(s => s.date >= todayStr);
  const past = rs.filter(s => s.date < todayStr);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white ${rider.active ? 'bg-indigo-600' : 'bg-slate-400'}`}>
              {rider.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{rider.name}</h3>
              <p className="text-xs text-slate-500">{rider.phone} • {rider.cpf}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="bg-indigo-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-indigo-700">{upcoming.length}</p>
            <p className="text-xs text-indigo-500">Futuras</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-slate-700">{past.length}</p>
            <p className="text-xs text-slate-500">Passadas</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-2 py-2 text-center">
            <p className="text-lg font-bold text-slate-700">{rs.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {rs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Nenhuma escala cadastrada.</p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Próximas escalas</p>
                  <div className="space-y-2">
                    {upcoming.map(sch => {
                      const est = establishments.find(e => e.id === sch.establishmentId);
                      const isToday = sch.date === todayStr;
                      return (
                        <div key={sch.id} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${isToday ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isToday && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                              <p className="text-sm font-semibold text-slate-800 truncate">{est?.name || 'N/A'}</p>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
                              <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span className="text-slate-300">•</span>
                              <span className={`font-medium ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono">{sch.startTime}–{sch.endTime}</span>
                            </p>
                          </div>
                          <button onClick={() => onCancelSchedule(sch.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase">Histórico de escalas</p>
                    <span className="text-xs text-slate-400">{past.length} registro{past.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Search className="h-3 w-3" />Filtrar histórico
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <select
                        value={modalHistoryEst}
                        onChange={e => setModalHistoryEst(e.target.value)}
                        className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Todos os estabelecimentos</option>
                        {Array.from(new Set(past.map(s => s.establishmentId))).map(eid => {
                          const e = establishments.find(x => x.id === eid);
                          return e ? <option key={e.id} value={e.id}>{e.name}</option> : null;
                        })}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">De</label>
                          <input type="date" value={modalHistoryFrom} onChange={e => setModalHistoryFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Até</label>
                          <input type="date" value={modalHistoryTo} onChange={e => setModalHistoryTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                      </div>
                      {(modalHistoryEst || modalHistoryFrom || modalHistoryTo) && (
                        <button onClick={() => { setModalHistoryEst(''); setModalHistoryFrom(''); setModalHistoryTo(''); }} className="text-xs text-indigo-600 hover:underline text-left font-medium">Limpar filtros</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 opacity-70">
                    {past
                      .filter(s => (!modalHistoryEst || s.establishmentId === modalHistoryEst) && (!modalHistoryFrom || s.date >= modalHistoryFrom) && (!modalHistoryTo || s.date <= modalHistoryTo))
                      .map(sch => {
                        const est = establishments.find(e => e.id === sch.establishmentId);
                        return (
                          <div key={sch.id} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700 truncate">{est?.name || 'N/A'}</p>
                                <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1">
                                  <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className={`font-medium ${sch.shift === 'morning' ? 'text-amber-500' : sch.shift === 'afternoon' ? 'text-orange-500' : 'text-blue-500'}`}>{getShiftLabel(sch.shift)}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-mono">{sch.startTime}–{sch.endTime}</span>
                                </p>
                              </div>
                              <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0">Concluída</span>
                            </div>
                          </div>
                        );
                      })}
                    {past.filter(s => (!modalHistoryEst || s.establishmentId === modalHistoryEst) && (!modalHistoryFrom || s.date >= modalHistoryFrom) && (!modalHistoryTo || s.date <= modalHistoryTo)).length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400">Nenhum registro com os filtros selecionados.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
          <button
            onClick={() => onNewSchedule(rider.id)}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Nova Escala
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}