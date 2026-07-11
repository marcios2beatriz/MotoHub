"use client";

import React from 'react';
import { X } from 'lucide-react';
import { Establishment } from '../utils/db';

interface EstablishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEst: Establishment | null;
  estForm: {
    name: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
  };
  setEstForm: React.Dispatch<React.SetStateAction<{
    name: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
  }>>;
  onSave: (e: React.FormEvent) => void;
}

export default function EstablishmentModal({
  isOpen,
  onClose,
  editingEst,
  estForm,
  setEstForm,
  onSave
}: EstablishmentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {editingEst ? 'Editar Estabelecimento' : 'Cadastrar Estabelecimento'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Estabelecimento</label>
            <input
              type="text"
              required
              value={estForm.name}
              onChange={(e) => setEstForm({ ...estForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rua / Logradouro</label>
              <input
                type="text"
                required
                value={estForm.street}
                onChange={(e) => setEstForm({ ...estForm, street: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número</label>
              <input
                type="text"
                required
                value={estForm.number}
                onChange={(e) => setEstForm({ ...estForm, number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bairro</label>
              <input
                type="text"
                required
                value={estForm.neighborhood}
                onChange={(e) => setEstForm({ ...estForm, neighborhood: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Complemento</label>
              <input
                type="text"
                value={estForm.complement}
                onChange={(e) => setEstForm({ ...estForm, complement: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade</label>
              <input
                type="text"
                required
                value={estForm.city}
                onChange={(e) => setEstForm({ ...estForm, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado</label>
              <input
                type="text"
                required
                maxLength={2}
                placeholder="SP"
                value={estForm.state}
                onChange={(e) => setEstForm({ ...estForm, state: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP</label>
              <input
                type="text"
                required
                placeholder="00000-000"
                value={estForm.zipCode}
                onChange={(e) => setEstForm({ ...estForm, zipCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
              <input
                type="text"
                required
                placeholder="(11) 3333-3333"
                value={estForm.phone}
                onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}