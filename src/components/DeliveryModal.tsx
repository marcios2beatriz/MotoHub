"use client";

import React from 'react';
import { X } from 'lucide-react';
import { User, Establishment, Delivery } from '../utils/db';

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDelivery: Delivery | null;
  riders: User[];
  establishments: Establishment[];
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
  onSave: (e: React.FormEvent) => void;
}

export default function DeliveryModal({
  isOpen,
  onClose,
  editingDelivery,
  riders,
  establishments,
  deliveryForm,
  setDeliveryForm,
  onSave
}: DeliveryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {editingDelivery ? 'Editar Corrida' : 'Lançar Nova Corrida'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motoboy</label>
            <select
              required
              value={deliveryForm.riderId}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, riderId: e.target.value })}
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
              value={deliveryForm.establishmentId}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, establishmentId: e.target.value })}
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0,00"
                value={deliveryForm.value}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, value: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº do Pedido (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: 1234"
                value={deliveryForm.orderNumber}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, orderNumber: e.target.value })}
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