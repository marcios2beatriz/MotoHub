"use client";

import React from 'react';
import { X, Hash } from 'lucide-react';
import { User, Establishment } from '../utils/db';

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  deliveryForm: {
    riderId: string;
    establishmentId: string;
    date: string;
    time: string;
    value: string;
    orderNumber: string;
  };
  setDeliveryForm: React.Dispatch<React.SetStateAction<{
    riderId: string;
    establishmentId: string;
    date: string;
    time: string;
    value: string;
    orderNumber: string;
  }>>;
  riders: User[];
  establishments: Establishment[];
  isEditing: boolean;
}

export default function DeliveryModal({
  isOpen,
  onClose,
  onSubmit,
  deliveryForm,
  setDeliveryForm,
  riders,
  establishments,
  isEditing
}: DeliveryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {isEditing ? 'Editar Corrida' : 'Lançar Nova Corrida'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
            <select
              required
              value={deliveryForm.riderId}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            >
              <option value="">Selecione um Motoboy</option>
              {riders.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estabelecimento</label>
            <select
              required
              value={deliveryForm.establishmentId}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, establishmentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
            >
              <option value="">Selecione um Estabelecimento</option>
              {establishments.map(e => (
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
                value={deliveryForm.date}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
              <input
                type="time"
                required
                value={deliveryForm.time}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº do Pedido (Opcional)</label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Hash className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Ex: 1042"
                value={deliveryForm.orderNumber}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor da Corrida (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={deliveryForm.value}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
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
              {isEditing ? 'Salvar Alterações' : 'Lançar Corrida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}