"use client";

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { User, Establishment } from '../utils/db';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: User[];
  establishments: Establishment[];
  scheduleForm: {
    riderId: string;
    establishmentId: string;
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
  };
  setScheduleForm: React.Dispatch<React.SetStateAction<{
    riderId: string;
    establishmentId: string;
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
    startTime: string;
    endTime: string;
  }>>;
  scheduleConflictWarning: string;
  setScheduleConflictWarning: (val: string) => void;
  onSave: (e: React.FormEvent) => void;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  riders,
  establishments,
  scheduleForm,
  setScheduleForm,
  scheduleConflictWarning,
  setScheduleConflictWarning,
  onSave
}: ScheduleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Criar Nova Escala</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {scheduleConflictWarning && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 font-medium">Conflito de Escala</p>
              <p className="text-xs text-amber-700 mt-1">{scheduleConflictWarning}</p>
              <p className="text-xs text-amber-600 mt-2 font-semibold">Deseja confirmar mesmo assim?</p>
            </div>
          </div>
        )}

        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
            <select
              required
              value={scheduleForm.riderId}
              onChange={(e) => {
                setScheduleForm({ ...scheduleForm, riderId: e.target.value });
                setScheduleConflictWarning('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
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
              value={scheduleForm.establishmentId}
              onChange={(e) => {
                setScheduleForm({ ...scheduleForm, establishmentId: e.target.value });
                setScheduleConflictWarning('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            >
              <option value="">Selecione um Estabelecimento</option>
              {establishments.filter(e => e.active).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                required
                value={scheduleForm.date}
                onChange={(e) => {
                  setScheduleForm({ ...scheduleForm, date: e.target.value });
                  setScheduleConflictWarning('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
              <select
                required
                value={scheduleForm.shift}
                onChange={(e: any) => {
                  setScheduleForm({ ...scheduleForm, shift: e.target.value });
                  setScheduleConflictWarning('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              >
                <option value="morning">Manhã</option>
                <option value="afternoon">Tarde</option>
                <option value="night">Noite</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Início</label>
              <input
                type="time"
                required
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Término</label>
              <input
                type="time"
                required
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              {scheduleConflictWarning ? 'Confirmar Mesmo Assim' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}