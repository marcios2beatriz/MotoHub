"use client";

import React from 'react';
import { X, CalendarDays, Check, AlertTriangle } from 'lucide-react';
import { User, Establishment } from '../utils/db';

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: User[];
  establishments: Establishment[];
  weeklyForm: {
    riderId: string;
    establishmentId: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
    weekStart: string;
    days: { seg: boolean; ter: boolean; qua: boolean; qui: boolean; sex: boolean; sab: boolean; dom: boolean };
  };
  setWeeklyForm: React.Dispatch<React.SetStateAction<{
    riderId: string;
    establishmentId: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
    weekStart: string;
    days: { seg: boolean; ter: boolean; qua: boolean; qui: boolean; sex: boolean; sab: boolean; dom: boolean };
  }>>;
  weeklyPreview: { date: string; label: string; conflict: boolean; key: string; enabled: boolean }[];
  setWeeklyPreview: React.Dispatch<React.SetStateAction<{ date: string; label: string; conflict: boolean; key: string; enabled: boolean }[]>>;
  weeklyStep: 'form' | 'preview';
  setWeeklyStep: (step: 'form' | 'preview') => void;
  buildWeeklyPreview: (form: any) => void;
  onSave: () => void;
  getShiftLabel: (shift: string) => string;
}

export default function WeeklyScheduleModal({
  isOpen,
  onClose,
  riders,
  establishments,
  weeklyForm,
  setWeeklyForm,
  weeklyPreview,
  setWeeklyPreview,
  weeklyStep,
  setWeeklyStep,
  buildWeeklyPreview,
  onSave,
  getShiftLabel
}: WeeklyScheduleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
              Escala Semanal Automática
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {weeklyStep === 'form' ? 'Configure a escala para a semana' : 'Revise os dias antes de confirmar'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {weeklyStep === 'form' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
              <select
                required
                value={weeklyForm.riderId}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, riderId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecione um Motoboy</option>
                {riders.filter(r => r.active).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
              <select
                required
                value={weeklyForm.establishmentId}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, establishmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecione um Estabelecimento</option>
                {establishments.filter(e => e.active).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semana (início na segunda-feira)</label>
              <input
                type="date"
                value={weeklyForm.weekStart}
                onChange={(e) => setWeeklyForm({ ...weeklyForm, weekStart: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
                <select
                  value={weeklyForm.shift}
                  onChange={(e: any) => setWeeklyForm({ ...weeklyForm, shift: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="morning">Manhã</option>
                  <option value="afternoon">Tarde</option>
                  <option value="night">Noite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label>
                <input
                  type="time"
                  value={weeklyForm.startTime}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Término</label>
                <input
                  type="time"
                  value={weeklyForm.endTime}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dias que o estabelecimento funciona</label>
              <div className="grid grid-cols-7 gap-1">
                {(['seg','ter','qua','qui','sex','sab','dom'] as const).map((key, idx) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWeeklyForm({ ...weeklyForm, days: { ...weeklyForm.days, [key]: !weeklyForm.days[key] } })}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                      weeklyForm.days[key]
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-400 border-slate-200 line-through'
                    }`}
                  >
                    {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][idx]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Clique para ativar/desativar dias</p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!weeklyForm.riderId || !weeklyForm.establishmentId || !weeklyForm.weekStart) {
                    alert('Preencha motoboy, estabelecimento e semana.');
                    return;
                  }
                  if (!Object.values(weeklyForm.days).some(Boolean)) {
                    alert('Selecione pelo menos um dia da semana.');
                    return;
                  }
                  buildWeeklyPreview(weeklyForm);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                Pré-visualizar →
              </button>
            </div>
          </div>
        )}

        {weeklyStep === 'preview' && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1 border border-slate-200">
              <p><span className="font-semibold text-slate-600">Motoboy:</span> {riders.find(r => r.id === weeklyForm.riderId)?.name}</p>
              <p><span className="font-semibold text-slate-600">Estabelecimento:</span> {establishments.find(e => e.id === weeklyForm.establishmentId)?.name}</p>
              <p><span className="font-semibold text-slate-600">Turno:</span> {getShiftLabel(weeklyForm.shift)} ({weeklyForm.startTime} - {weeklyForm.endTime})</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dias gerados — desmarque se necessário</label>
              <div className="space-y-2">
                {weeklyPreview.map((day) => (
                  <div
                    key={day.date}
                    onClick={() => setWeeklyPreview((prev) =>
                      prev.map((d) => d.date === day.date ? { ...d, enabled: !d.enabled } : d)
                    )}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      !day.enabled
                        ? 'bg-slate-50 border-slate-200 opacity-50'
                        : day.conflict
                          ? 'bg-amber-50 border-amber-300'
                          : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        day.enabled ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                      }`}>
                        {day.enabled && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${day.enabled ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {day.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    {day.conflict && day.enabled && (
                      <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Conflito
                      </span>
                    )}
                    {!day.enabled && (
                      <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">Ignorado</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">Clique em um dia para ativar/desativar</p>
            </div>

            {weeklyPreview.some((d) => d.conflict && d.enabled) && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded text-sm text-amber-800">
                <strong>Atenção:</strong> Alguns dias marcados já possuem escala para este motoboy e turno. Eles serão criados mesmo assim.
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setWeeklyStep('form')}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Voltar
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!weeklyPreview.some((d) => d.enabled)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar {weeklyPreview.filter((d) => d.enabled).length} dia(s)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}