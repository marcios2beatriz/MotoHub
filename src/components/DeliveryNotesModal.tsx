"use client";

import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { Delivery } from '../utils/db';

interface DeliveryNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  userRole: 'admin' | 'rider' | 'establishment';
  userName: string;
  onSaveNotes: (deliveryId: string, updatedNotes: string) => void;
}

export default function DeliveryNotesModal({
  isOpen,
  onClose,
  delivery,
  userRole,
  userName,
  onSaveNotes
}: DeliveryNotesModalProps) {
  const [newMessage, setNewMessage] = useState('');

  if (!isOpen || !delivery) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    const senderLabel = userRole === 'establishment' ? 'Estabelecimento' : userRole === 'rider' ? 'Motoboy' : 'Admin';
    const formattedMessage = `[${dateStr} ${timeStr} - ${senderLabel} (${userName})]: ${newMessage.trim()}`;
    
    const updatedNotes = delivery.notes 
      ? `${delivery.notes}\n${formattedMessage}`
      : formattedMessage;

    onSaveNotes(delivery.id, updatedNotes);
    setNewMessage('');
  };

  // Divide as notas por linha para renderizar como mensagens de chat
  const messages = delivery.notes ? delivery.notes.split('\n') : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Observações / Chat</h3>
              <p className="text-xs text-slate-500">Pedido #{delivery.orderNumber || delivery.id.slice(-4)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Histórico de Mensagens */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg min-h-[200px] max-h-[400px]">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhuma observação registrada. Envie uma mensagem abaixo!
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isSystem = !msg.startsWith('[');
              if (isSystem) {
                return (
                  <div key={idx} className="bg-slate-200 text-slate-700 text-[11px] px-2.5 py-1 rounded-md italic text-center">
                    {msg}
                  </div>
                );
              }

              const isMe = msg.includes(`- ${userRole === 'establishment' ? 'Estabelecimento' : userRole === 'rider' ? 'Motoboy' : 'Admin'}`);
              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm ${
                    isMe ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'
                  }`}>
                    <p className="leading-relaxed">{msg.substring(msg.indexOf(']: ') + 3)}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                    {msg.substring(1, msg.indexOf(']'))}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Campo de Envio */}
        <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            placeholder="Digite uma observação ou aviso..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}