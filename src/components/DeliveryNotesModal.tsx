"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, AlertCircle } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, delivery?.notes]);

  if (!isOpen || !delivery) return null;

  // Calcula se o chat já expirou (10 horas desde o lançamento da corrida)
  const deliveryDateTime = new Date(`${delivery.date}T${delivery.time}:00`);
  const timeDifferenceMs = Date.now() - deliveryDateTime.getTime();
  const tenHoursInMs = 10 * 60 * 60 * 1000;
  const isExpired = timeDifferenceMs > tenHoursInMs;

  const isRejected = delivery.status === 'rejected';
  const isCancelled = delivery.status === 'cancelled';
  const isDisabled = isExpired || isRejected || isCancelled;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) {
      alert('Este chat está bloqueado e não aceita mais novas mensagens.');
      return;
    }
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

        {/* Alerta de Expiração ou Rejeição */}
        {isExpired && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-amber-800 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Chat Expirado</p>
              <p className="mt-0.5">Já se passaram mais de 10 horas desde o lançamento desta corrida. Não é mais possível enviar novas mensagens.</p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-800 text-xs">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Corrida Rejeitada</p>
              <p className="mt-0.5">Esta corrida foi rejeitada. O chat está bloqueado para novas mensagens, permitindo apenas a visualização do histórico e justificativa.</p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-start gap-2 text-slate-800 text-xs">
            <AlertCircle className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Corrida Cancelada</p>
              <p className="mt-0.5">Esta corrida foi cancelada. O chat está bloqueado para novas mensagens.</p>
            </div>
          </div>
        )}

        {/* Histórico de Mensagens */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg min-h-[200px] max-h-[400px]">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhuma observação registrada.
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
              const senderInfo = msg.substring(msg.indexOf('- ') + 2, msg.indexOf(']:'));

              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[9px] text-slate-500 mb-0.5 font-semibold px-1">
                      {senderInfo}
                    </span>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm ${
                    isMe ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'
                  }`}>
                    <p className="leading-relaxed">{msg.substring(msg.indexOf(']: ') + 3)}</p>
                  </div>
                  <span className="text-[8px] text-slate-400 mt-0.5 px-1">
                    {msg.substring(1, msg.indexOf(']'))}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Campo de Envio */}
        <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            disabled={isDisabled}
            placeholder={
              isExpired ? "Chat bloqueado por expiração" :
              isRejected ? "Chat bloqueado por rejeição" :
              isCancelled ? "Chat bloqueado por cancelamento" :
              "Digite uma observação ou aviso..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}