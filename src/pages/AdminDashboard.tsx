|                                                                                                                                   ^
1631|  import React, { useState, useEffect } from 'react';
</message>
<message role="assistant"></message><dyad-write path="src/pages/AdminDashboard.tsx" description="Corrigindo o erro de sintaxe no AdminDashboard.tsx - fechando a tag span e a string de classe corretamente">
                                              {isTod && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800 truncate">{est?.name || 'N/A'}</p>
                                            <span className="text-slate-300">•</span>
                                            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                                              <span>{new Date(sch.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                              <span className="text-slate-300">•</span>
                                              <span className={`font-medium ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</span>
                                              <span className="text-slate-300">•</span>
                                              <span className="font-mono text-slate-600">{sch.startTime}–{sch.endTime}</span>
                                            </p>
                                          </div>
                                        </div>
                                        <button onClick={() => handleCancelSchedule(sch.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );

                if (scheduleViewMode === 'grid') return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredList.map(rider => {
                      const rs = schedules.filter(s => s.riderId === rider.id).sort((a,b) => a.date.localeCompare(b.date));
                      const up = rs.filter(s => s.date >= todayStr);
                      const next = up[0];
                      const nextEst = next ? establishments.find(e => e.id === next.establishmentId) : null;
                      return (
                        <div key={rider.id} className="border border-slate-200 rounded-xl bg-white p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${rider.active ? 'bg-indigo-600' : 'bg-slate-400'}`}>{rider.name.charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{rider.name}</p>
                              <p className="text-xs text-slate-500 truncate">{rider.phone}</p>
                              <p className="text-xs text-slate-400 truncate">{rider.cpf}</p>
                            </div>
                            {!rider.active && <span className="ml-auto bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full flex-shrink-0">Inativo</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-indigo-50 rounded-lg px-3 py-2 text-center">
                              <p className="text-xl font-bold text-indigo-700">{up.length}</p>
                              <p className="text-xs text-indigo-500">Futuras</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                              <p className="text-xl font-bold text-slate-700">{rs.length}</p>
                              <p className="text-xs text-slate-500">Total</p>
                            </div>
                          </div>
                          {next ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Próxima escala</p>
                              <p className="text-sm font-semibold text-slate-800 truncate">{nextEst?.name || 'N/A'}</p>
                              <p className="text-sm font-semibold text-slate-500 mt-0.5">
                                {new Date(next.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                                {' · '}<span className={`font-medium ${next.shift === 'morning' ? 'text-amber-600' : next.shift === 'afternoon' ? 'text-orange-600' : next.shift === 'night' ? 'text-blue-600' : ''}`}>{getShiftLabel(next.shift)}</span>
                                {' · '}{next.startTime}–{next.endTime}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-center text-xs text-slate-400">Sem escalas futuras</div>
                          )}
                          <div className="flex gap-2 mt-auto">
                            <button onClick={() => { setScheduleForm({ riderId: rider.id, establishmentId: '', date: todayStr, shift: 'morning', startTime: '08:00', endTime: '12:00' }); setScheduleConflictWarning(''); setShowScheduleModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium py-2 rounded-lg transition-colors">
                              <Plus className="h-3.5 w-3.5" />Nova Escala
                            </button>
                            <button onClick={() => setRiderSchedulesModal(rider.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium py-2 rounded-lg transition-colors">
                              <List className="h-3.5 w-3.5" />Ver Todas
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );

                const riderIds = new Set(filteredList.map(r => r.id));
                const allUp = schedules.filter(s => s.date >= todayStr && riderIds.has(s.riderId)).sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
                const byDate: Record<string, typeof allUp> = {};
                allUp.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });

                if (allUp.length === 0) return (
                  <div className="py-10 text-center text-slate-400">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p>Nenhuma escala futura encontrada.</p>
                  </div>
                );

                return (
                  <div className="space-y-6">
                    {Object.entries(byDate).map(([date, daySchs]) => {
                      const isTod = date === todayStr;
                      const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
                      return (
                        <div key={date}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isTod ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{isTod ? 'Hoje' : dateLabel}</div>
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-xs text-slate-400">{daySchs.length} escala{daySchs.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="space-y-2">
                            {daySchs.map(sch => {
                              const rider = users.find(r => r.id === sch.riderId);
                              const est = establishments.find(e => e.id === sch.establishmentId);
                              return (
                                <div key={sch.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-200 transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {isTod && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Hoje</span>}
                                      <p className="text-sm font-semibold text-slate-800 truncate">{rider?.name || 'N/A'}</p>
                                      <span className="text-slate-300">•</span>
                                      <p className="text-xs text-slate-500 truncate">{est?.name || 'N/A'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right">
                                      <p className={`text-xs font-bold ${sch.shift === 'morning' ? 'text-amber-600' : sch.shift === 'afternoon' ? 'text-orange-600' : 'text-blue-600'}`}>{getShiftLabel(sch.shift)}</p>
                                      <p className="text-xs font-mono text-slate-600">{sch.startTime}–{sch.endTime}</p>
                                    </div>
                                    <button onClick={() => handleCancelSchedule(sch.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: REGISTRO DE CORRIDAS */}
          {activeTab === 'deliveries' && (
            <div className="space-y-6">
              {/* Pending Deliveries Approval Section */}
              {pendingDeliveries.length > 0 && (
                <div className="bg-amber-50/50 p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <h2 className="text-lg font-bold text-amber-800 flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                    <span>Corridas Pendentes de Aprovação ({pendingDeliveries.length})</span>
                  </h2>

                  <div className="divide-y divide-amber-100">
                    {pendingDeliveries.map(del => {
                      const rider = users.find(r => r.id === del.riderId);
                      const est = establishments.find(e => e.id === del.establishmentId);
                      return (
                        <div key={del.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-slate-800">{rider?.name || 'Motoboy'}</p>
                              {del.orderNumber && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                  #{del.orderNumber}
                                )
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">Estabelecimento: {est?.name}</p>
                            <p className="text-xs text-slate-400 flex items-center space-x-1 mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Lançada em {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}</span>
                            </p>
                            {del.notes && (
                              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 mt-1.5 italic>
                                Obs: {del.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 self-end sm:self-center>
                            <span className="font-bold text-amber-700 text-lg">R$ {del.value.toFixed(2)}</span>
                            <div className="flex items-center space-x-1>
                              <button
                                onClick={() => handleApproveDelivery(del.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                                title="Aprovar Corrida"
                              >
                                <Check className="h-4 w-4" />
                                <span className="hidden sm:inline">Aprovar</span>
                              </button>
                              <button
                                onClick={() => handleRejectDelivery(del.id)}
                                className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold"
                                title="Rejeitar Corrida"
                              >
                                <X className="h-4 w-4" />
                                <span className="hidden sm:inline">Rejeitar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-slate-800">Registro de Corridas</h2>
                  <button
                    onClick={() => {
                      setEditingDelivery(null);
                      setDeliveryForm({ riderId: '', establishmentId: '', date: db.getLocalDateString(), time: new Date().toTimeString().slice(0,5), value: '', orderNumber: '', notes: '' });
                      setShowDeliveryModal(true);
                    }}
                    className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Lançar Corrida</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700>Histórico de Lançamentos</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {processedDeliveries.length === 0 ? (
                      <div className="p-8 text-center text-slate-400>Nenhuma corrida registrada.</div>
                    ) : (
                      processedDeliveries.map(del => {
                        const rider = users.find(r => r.id === del.riderId);
                        const est = establishments.find(e => e.id === del.establishmentId);
                        const isToday = del.date === db.getLocalDateString();

                        return (
                          <div key={del.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50>
                            <div>
                              <div className="flex items-center space-x-2>
                                <p className="font-bold text-slate-800>{rider?.name || 'Motoboy'}</p>
                                {del.status === 'cancelled' && (
                                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py=0.5 rounded-full>Cancelada</span>
                                )}
                                {del.status === 'rejected' && (
                                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py=0.5 rounded-full>Rejeitada</span>
                                )}
                                {del.orderNumber && (
                                  <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py=0.5 rounded-full>
                                    #{del.orderNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600>Estabelecimento: {est?.name}</p>
                              <p className="text-xs text-slate-400 mt-1>
                                Data: {new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {del.time}
                              </p>
                              {del.notes && (
                                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py=1.5 italic>
                                  Obs: {del.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 self-end sm:self-center>
                              <span className={`font-bold text-lg ${del.status === 'cancelled' || del.status === 'rejected' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                                R$ {del.value.toFixed(2)}
                              </span>
                              {isToday && del.status === 'active' && (
                                <div className="flex items-center space-x-1>
                                  <button
                                    onClick={() => {
                                      setEditingDelivery(del);
                                      setDeliveryForm({
                                        riderId: del.riderId,
                                        establishmentId: del.establishmentId,
                                        date: del.date,
                                        time: del.time,
                                        value: del.value.toString(),
                                        orderNumber: del.orderNumber || '',
                                        notes: del.notes || ''
                                      });
                                      setShowDeliveryModal(true);
                                    }}
                                    className="text-slate-500 hover:bg-slate-100 p-2 rounded transition-colors"
                                    title="Editar Corrida"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelDelivery(del.id)}
                                    className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                                    title="Cancelar Corrida"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RELATÓRIOS */}
          {activeTab === 'reports' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4>
                <h2 className="text-xl font-bold text-slate-800>Relatórios Gerenciais</h2>
                <button
                  onClick={exportToCSV}
                  className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py=2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2>Tipo de Relatório</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="w-full px-3 py=2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="earnings">Faturamento por Motoboy</option>
                    <option value="deliveries">Quantidade de Corridas por Motoboy</option>
                    <option value="schedules">Escalas por Estabelecimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2>Período</label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as any)}
                    className="w-full px-3 py=2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
                {reportPeriod === 'custom' && (
                  <div className="space-y-2>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1>Data Inicial</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py=2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1>Data Final</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py=2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        editingUser={editingUser}
        userForm={userForm}
        setUserForm={setUserForm}
        establishments={establishments}
        onSave={handleSaveUser}
      />

      <EstablishmentModal
        isOpen={showEstModal}
        onClose={() => setShowEstModal(false)}
        editingEst={editingEst}
        estForm={estForm}
        setEstForm={setEstForm}
        onSave={handleSaveEst}
      />

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        scheduleForm={scheduleForm}
        setScheduleForm={setScheduleForm}
        scheduleConflictWarning={scheduleConflictWarning}
        setScheduleConflictWarning={setScheduleConflictWarning}
        onSave={handleSaveSchedule}
      />

      <WeeklyScheduleModal
        isOpen={showWeeklyModal}
        onClose={() => setShowWeeklyModal(false)}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        weeklyForm={weeklyForm}
        setWeeklyForm={setWeeklyForm}
        weeklyPreview={weeklyPreview}
        setWeeklyPreview={setWeeklyPreview}
        weeklyStep={weeklyStep}
        setWeeklyStep={setWeeklyStep}
        buildWeeklyPreview={buildWeeklyPreview}
        onSave={handleSaveWeeklySchedule}
        getShiftLabel={getShiftLabel}
      />

      <RiderSchedulesModal
        riderId={riderSchedulesModal}
        onClose={() => setRiderSchedulesModal(null)}
        riders={users.filter(u => u.role === 'rider')}
        schedules={schedules}
        establishments={establishments}
        modalHistoryEst={modalHistoryEst}
        setModalHistoryEst={setModalHistoryEst}
        modalHistoryFrom={modalHistoryFrom}
        setModalHistoryFrom={setModalHistoryFrom}
        modalHistoryTo={modalHistoryTo}
        setModalHistoryTo={setModalHistoryTo}
        onCancelSchedule={handleCancelSchedule}
        onNewSchedule={(riderId) => {
          setRiderSchedulesModal(null);
          setScheduleForm({
            riderId,
            establishmentId: '',
            date: db.getLocalDateString(),
            shift: 'morning',
            startTime: '08:00',
            endTime: '12:00'
          });
          setScheduleConflictWarning('');
          setShowScheduleModal(true);
        }}
        getShiftLabel={getShiftLabel}
      />

      <DeliveryModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        editingDelivery={editingDelivery}
        riders={users.filter(u => u.role === 'rider')}
        establishments={establishments}
        deliveryForm={deliveryForm}
        setDeliveryForm={setDeliveryForm}
        onSave={handleSaveDelivery}
      />
    </div>
  );
}