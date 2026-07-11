"use client";

import React from 'react';
import { X } from 'lucide-react';
import { User } from '../utils/db';

interface RiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRider: User | null;
  riderForm: { name: string; cpf: string; phone: string; email: string; password: '' | string };
  setRiderForm: React.Dispatch<React.SetStateAction<{ name: string; cpf: string; phone: string; email: string; password: '' | string }>>;
  onSave: (e: React.FormEvent) => void;
}

export default function RiderModal({
  isOpen,
  onClose,
  editingRider,
  riderForm,
  setRiderForm,
  onSave
}: RiderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {editingRider ? 'Editar Motoboy' : 'Cadastrar Novo Motoboy'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
            <input
              type="text"
              required
              value={riderForm.name}
              onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
            <input
              type="text"
              required
              placeholder="000.000.000-00"
              value={riderForm.cpf}
              onChange={(e) => setRiderForm({ ...riderForm, cpf: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
            <input
              type="text"
              required
              placeholder="(11) 99999-9999"
              value={riderForm.phone}
              onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
            <input
              type="email"
              required
              value={riderForm.email}
              onChange={(e) => setRiderForm({ ...riderForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              {editingRider ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial'}
            </label>
            <input
              type="password"
              required={!editingRider}
              value={riderForm.password}
              onChange={(e) => setRiderForm({ ...riderForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}