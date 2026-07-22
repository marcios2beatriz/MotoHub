"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, AlertCircle, Lock, Clock } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen && delivery?.status !== 'rejected') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, delivery?.notes, delivery?.status]);

  if (!isOpen || !delivery) return null;

  const deliveryDateTime = new Date(`${delivery.date}T${delivery.time}:00`);
  const timeDifferenceMs = Date.now() - deliveryDateTime.getTime();
  
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  const isRejected = delivery.status === 'rejected';
  const isApproved = delivery.status === 'active';
  const isPending = delivery.status === 'pending';
  const isCancelled = delivery.status === 'cancelled';

  let isExpired = false;
  let remainingLabel = '';

  if (isPending) {
    isExpired = timeDifferenceMs > EIGHT_HOURS_MS;
    const hoursLeft = Math.max(0, Math.ceil((EIGHT_HOURS_MS - timeDifferenceMs) / (1000 * 60 * 60)));
    remainingLabel = `Pendente (${hoursLeft}h restantes para interagir)`;
  } else if (isApproved) {
    isExpired = timeDifferenceMs > FOUR_HOURS_MS;
    const hoursLeft = Math.max(0, Math.ceil((FOUR_HOURS_MS - timeDifferenceMs) / (1000 * 60 * 60)));
    remainingLabel = `Aprovado (${hoursLeft}h restantes para interagir)`;
  } else {
    isExpired = true;
  }

  // O chat encerra instantaneamente se rejeitado/cancelado ou se o tempo expirou
  const isBlocked = isRejected || isCancelled || isExpired;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) {
      if (isRejected) {
        alert('Esta corrida foi rejeitada. O campo de observações está encerrado.');
      } else if (isExpired) {
        alert('O prazo de interatividade deste chat expirou.');
      } else {
        alert('Esta corrida está bloqueada para novas alterações.');
      }
      return;
    }
    if (!newMessage.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  const getRejectionJustification = () => {
    if (!delivery.notes) return 'Nenhuma justificativa informada';
    if (delivery.notes.includes('Rejeitado:')) {
      const parts = delivery.notes.split('Rejeitado:');
      return parts[parts.length - 1].trim() || 'Nenhuma justificativa informada';
    }
    if (delivery.notes.includes('Motivo da rejeição:')) {
      const parts = delivery.notes.split('Motivo da rejeição:');
      return parts[parts.length - 1].trim() || 'Nenhuma justificativa informada';
    }
    return delivery.notes;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Observações / Instruções</h3>
              <p className="text-xs text-slate-500">Pedido #{delivery.orderNumber || delivery.id.slice(-4)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isRejected ? (
          <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 text-center space-y-4">
            <div className="p-3 bg-red-50 rounded-full text-red-600">
              <AlertCircle className="h-10 w-10" />
            </div>
            <div className="space-y-2 w-full">
              <h4 className="text-base font-bold text-red-800">Corrida Rejeitada (Prazo Encerrado)</h4>
              <div className="bg-red-50/50 border border-red-200 rounded-xl p-3 text-left">
                <p className="text-[10px] font-bold uppercase text-red-600">Justificativa do Estabelecimento:</p>
                <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                  "{getRejectionJustification()}"
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              A interatividade deste chat foi encerrada instantaneamente devido à rejeição.
            </p>
          </div>
        ) : (
          <>
            {isApproved && (
              <div className={`p-2.5 rounded-lg flex items-center gap-2 text-xs font-semibold ${
                isExpired ? 'bg-slate-100 border border-slate-200 text-slate-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}>
                {isExpired ? <Lock className="h-4 w-4 text-slate-500" /> : <Clock className="h-4 w-4 text-emerald-600" />}
                <span>{isExpired ? 'Prazo de 4h para interagir após aprovação expirou.' : `Corrida Aprovada — ${remainingLabel}`}</span>
              </div>
            )}

            {isPending && (
              <div className={`p-2.5 rounded-lg flex items-center gap-2 text-xs font-semibold ${
                isExpired ? 'bg-amber-100 border border-amber-300 text-amber-900' : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}>
                {isExpired ? <Lock className="h-4 w-4 text-amber-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                <span>{isExpired ? 'Prazo de 8h para interagir na corrida pendente expirou.' : remainingLabel}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-lg min-h-[200px] max-h-[350px]">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Nenhuma observação registrada até o momento.
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

            <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                disabled={isBlocked}
                placeholder={isBlocked ? "Chat encerrado" : "Digite uma observação..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isBlocked}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}