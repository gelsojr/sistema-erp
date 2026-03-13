import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MachineStatus } from '../types';
import StatusBadge from './StatusBadge';
import MetricCard from './MetricCard';
import WorkshopActivityTimeline from './WorkshopActivityTimeline';
import MachineList from './MachineList';
import { PencilIcon, ArrowUpIcon, ArrowDownIcon, CheckCircleIcon, InfoIcon, WrenchIcon, ClockIcon, GraderIcon, UsersIcon, HistoryIcon } from './icons';
// --- NEW WORKING HOURS LOGIC ---
const calculateWorkingHours = (startDateStr, startTimeStr) => {
    if (!startDateStr)
        return 0;
    const start = new Date(`${startDateStr}T${startTimeStr || '00:00'}:00`);
    const end = new Date();
    if (start >= end)
        return 0;
    const getMinutesForDay = (date, lowerBound, upperBound) => {
        const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
        // Working intervals: 07:00-11:00 and 13:00-18:00
        const morningStart = new Date(y, m, d, 7, 0, 0);
        const morningEnd = new Date(y, m, d, 11, 0, 0);
        const afternoonStart = new Date(y, m, d, 13, 0, 0);
        const afternoonEnd = new Date(y, m, d, 18, 0, 0);
        let mins = 0;
        // Morning Overlap
        const mStart = lowerBound > morningStart ? lowerBound : morningStart;
        const mEnd = upperBound < morningEnd ? upperBound : morningEnd;
        if (mStart < mEnd)
            mins += (mEnd.getTime() - mStart.getTime()) / 60000;
        // Afternoon Overlap
        const aStart = lowerBound > afternoonStart ? lowerBound : afternoonStart;
        const aEnd = upperBound < afternoonEnd ? upperBound : afternoonEnd;
        if (aStart < aEnd)
            mins += (aEnd.getTime() - aStart.getTime()) / 60000;
        return mins;
    };
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / oneDay);
    let totalMinutes = 0;
    if (diffDays === 0) {
        totalMinutes = getMinutesForDay(start, start, end);
    }
    else {
        // First day partial
        const firstDayEnd = new Date(start);
        firstDayEnd.setHours(23, 59, 59, 999);
        totalMinutes += getMinutesForDay(start, start, firstDayEnd);
        // Last day partial
        const lastDayStart = new Date(end);
        lastDayStart.setHours(0, 0, 0, 0);
        totalMinutes += getMinutesForDay(end, lastDayStart, end);
        // Full days in between (9 hours per day)
        if (diffDays > 1) {
            totalMinutes += (diffDays - 1) * 9 * 60;
        }
    }
    return totalMinutes / 60;
};
const OficinaView = ({ machines, allMachines, maintenanceTasks, recentlyReleasedMachines, notifications = [], onSelectMachine, onUpdateMachineStatus, onOpenOficinaEditModal, onResolveIssue, onOpenMaintenanceModal, }) => {
    const [openStatusPopoverId, setOpenStatusPopoverId] = useState(null);
    const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0 });
    const popoverRef = useRef(null);
    const handleScrollClose = useRef(() => setOpenStatusPopoverId(null));
    const [sortConfig, setSortConfig] = useState({ key: 'daysStopped', direction: 'descending' });
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setOpenStatusPopoverId(null);
            }
        };
        if (openStatusPopoverId) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScrollClose.current, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScrollClose.current, true);
        };
    }, [openStatusPopoverId]);
    const toggleStatusPopover = (e, machineId) => {
        if (openStatusPopoverId === machineId) {
            setOpenStatusPopoverId(null);
        }
        else {
            const rect = e.currentTarget.getBoundingClientRect();
            const popoverWidth = 192;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const minMargin = 12;
            const statusCount = Object.values(MachineStatus).length;
            const estimatedPopoverHeight = Math.min((viewportHeight * 0.7), 52 + statusCount * 42);
            let top = rect.bottom + 5;
            if (top + estimatedPopoverHeight > viewportHeight - minMargin)
                top = viewportHeight - estimatedPopoverHeight - minMargin;
            if (top < minMargin)
                top = minMargin;
            const minLeft = (popoverWidth / 2) + minMargin;
            const maxLeft = viewportWidth - (popoverWidth / 2) - minMargin;
            const rawLeft = rect.left + (rect.width / 2);
            const left = Math.min(Math.max(rawLeft, minLeft), Math.max(maxLeft, minLeft));
            setPopoverCoords({
                top,
                left
            });
            setOpenStatusPopoverId(machineId);
        }
    };
    const calculateHoursStopped = (statusChangeDate, lastStatusChangeTime) => {
        return Math.floor(calculateWorkingHours(statusChangeDate, lastStatusChangeTime));
    };
    // Helper for sorting (days based on 9h)
    const calculateDaysStopped = (statusChangeDate, lastStatusChangeTime) => {
        const totalHours = calculateWorkingHours(statusChangeDate, lastStatusChangeTime || '00:00');
        return Math.floor(totalHours / 9);
    };
    // Helper for Display (Detailed Duration based on working hours)
    const calculateDurationString = (statusChangeDate, lastStatusChangeTime) => {
        const totalHours = calculateWorkingHours(statusChangeDate, lastStatusChangeTime);
        const days = Math.floor(totalHours / 9);
        const hours = Math.floor(totalHours % 9);
        if (days > 0)
            return `${days}d ${hours}h`;
        return `${hours}h`;
    };
    const oficinaMetrics = useMemo(() => {
        const totalFleet = allMachines.length || 0;
        const stoppedCount = machines.length;
        const availabilityPercent = totalFleet > 0 ? ((totalFleet - stoppedCount) / totalFleet) * 100 : 0;
        const totalHoursSum = machines.reduce((acc, m) => acc + calculateHoursStopped(m.statusChangeDate, m.lastStatusChangeTime), 0);
        const avgHours = stoppedCount > 0 ? (totalHoursSum / stoppedCount) : 0;
        const pendingIssuesCount = allMachines.reduce((acc, m) => acc + (m.pendingIssues?.length || 0), 0);
        return { totalFleet, stoppedCount, availabilityPercent, avgHours, totalHoursSum, pendingIssuesCount };
    }, [machines, allMachines]);
    const sortedMachines = useMemo(() => {
        let sortableMachines = [...machines];
        if (sortConfig !== null) {
            sortableMachines.sort((a, b) => {
                let aValue;
                let bValue;
                if (sortConfig.key === 'daysStopped') {
                    aValue = calculateDaysStopped(a.statusChangeDate, a.lastStatusChangeTime);
                    bValue = calculateDaysStopped(b.statusChangeDate, b.lastStatusChangeTime);
                }
                else {
                    const dateA = a[sortConfig.key] ? new Date(a[sortConfig.key]).getTime() : 0;
                    const dateB = b[sortConfig.key] ? new Date(b[sortConfig.key]).getTime() : 0;
                    aValue = dateA || 0;
                    bValue = dateB || 0;
                }
                if (aValue < bValue)
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue)
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableMachines;
    }, [machines, sortConfig]);
    const getSortIcon = (key) => {
        if (!sortConfig || sortConfig.key !== key)
            return null;
        return sortConfig.direction === 'ascending' ? <ArrowUpIcon className="w-3 h-3 text-brand-accent"/> : <ArrowDownIcon className="w-3 h-3 text-brand-accent"/>;
    };
    const machinesWithIssues = useMemo(() => allMachines.filter(m => m.pendingIssues && m.pendingIssues.length > 0), [allMachines]);
    const getMotivo = (machine, tasks) => {
        if (machine.paralisacaoMotivo)
            return machine.paralisacaoMotivo;
        if (machine.status === MachineStatus.Maintenance) {
            const relevantTask = tasks.find(t => t.machineId === machine.id);
            if (relevantTask)
                return relevantTask.task;
        }
        return machine.status;
    };
    return (<div className="space-y-6">
      {/* 1. TOP METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <MetricCard title="Frota Obra" value={oficinaMetrics.totalFleet.toString()} icon={<GraderIcon className="w-6 h-6"/>} color="text-blue-400"/>
          <MetricCard title="Disponibilidade" value={`${oficinaMetrics.availabilityPercent.toFixed(1)}%`} icon={<CheckCircleIcon className="w-6 h-6"/>} color="text-green-400"/>
          <MetricCard title="Perm. Média (h)" value={`${oficinaMetrics.avgHours.toFixed(0)}h`} icon={<ClockIcon className="w-6 h-6"/>} color="text-indigo-400"/>
          <MetricCard title="Somatório de tempo na oficina" value={`${oficinaMetrics.totalHoursSum.toLocaleString('pt-BR')}h`} icon={<WrenchIcon className="w-8 h-8"/>} color="text-red-400"/>
          <MetricCard title="Solicit. Campo" value={oficinaMetrics.pendingIssuesCount.toString()} icon={<UsersIcon className="w-6 h-6"/>} color="text-cyan-400"/>
      </div>

      {/* 2. ALERTS */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-l-4 border-yellow-500">
          <h3 className="text-lg font-bold text-brand-light mb-4 flex items-center gap-2 uppercase tracking-tighter">
              <InfoIcon className="text-yellow-400 w-6 h-6"/>
              Alertas e Solicitações em Campo
          </h3>
          {machinesWithIssues.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {machinesWithIssues.flatMap(machine => machine.pendingIssues?.map(issue => (<div key={issue.id} className="bg-brand-primary p-4 rounded-md shadow border border-brand-secondary relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-black text-brand-accent text-xs uppercase">{machine.prefix} - {machine.name}</span>
                                    <span className="text-[10px] text-brand-muted font-mono">{new Date(issue.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                                <p className="text-brand-light text-xs mb-3 italic">"{issue.description}"</p>
                                <div className="flex justify-between items-center mt-auto">
                                    <span className="text-[10px] text-brand-muted">Por: {issue.reportedBy || 'Operador'}</span>
                                    <button onClick={() => onResolveIssue(machine.id, issue.id)} className="text-green-400 hover:text-green-300 text-[10px] font-black uppercase flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                                        <CheckCircleIcon className="w-3 h-3"/> Resolvido
                                    </button>
                                </div>
                          </div>)))}
              </div>) : (<div className="py-2 text-center text-brand-muted italic text-sm">Nenhuma solicitação pendente no campo.</div>)}
      </div>

      {/* 3. MAIN TABLE (STOCKED YARD) */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg overflow-visible h-auto">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="bg-brand-accent/20 p-2 rounded-lg">
                    <WrenchIcon className="w-6 h-6 text-brand-accent"/>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-brand-light uppercase tracking-tighter leading-none">Gestão do Pátio (Oficina)</h3>
                    <p className="text-[10px] text-brand-muted uppercase font-black tracking-widest mt-1">Equipamentos atualmente parados</p>
                </div>
            </div>
            <button onClick={onOpenMaintenanceModal} className="bg-brand-accent text-brand-primary px-4 py-2 rounded-lg font-black text-xs uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all">Agendar Manutenção</button>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-lg border border-brand-primary/60">
          <table className="min-w-full text-xs text-left text-brand-muted">
            <thead className="bg-brand-primary text-xs uppercase font-black sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 w-28 min-w-[112px]">Prefixo</th>
                <th className="px-4 py-4">Equipamento</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4"><button onClick={() => setSortConfig({ key: 'statusChangeDate', direction: sortConfig?.direction === 'ascending' ? 'descending' : 'ascending' })} className="flex items-center gap-1">Entrada {getSortIcon('statusChangeDate')}</button></th>
                <th className="px-4 py-4 text-center"><button onClick={() => setSortConfig({ key: 'daysStopped', direction: sortConfig?.direction === 'ascending' ? 'descending' : 'ascending' })} className="flex items-center justify-center gap-1 w-full">Tempo Pátio (Útil) {getSortIcon('daysStopped')}</button></th>
                <th className="px-4 py-4">Motivo / Tarefa</th>
                <th className="px-4 py-4 text-center">Previsão</th>
                <th className="px-4 py-4 text-center">Responsável</th>
                <th className="px-4 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-primary">
              {sortedMachines.map(machine => {
            const durationString = calculateDurationString(machine.statusChangeDate, machine.lastStatusChangeTime);
            return (<tr key={machine.id} className="hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-4 font-black text-brand-accent uppercase font-mono whitespace-nowrap w-28 min-w-[112px]">{machine.prefix}</td>
                      <td className="px-4 py-4 font-bold text-brand-light cursor-pointer hover:text-brand-accent" onClick={() => onSelectMachine(machine)}>{machine.name} {machine.model}</td>
                      <td className="px-4 py-4 text-center">
                          <button onClick={(e) => toggleStatusPopover(e, machine.id)} className="focus:outline-none">
                              <StatusBadge status={machine.status}/>
                          </button>
                      </td>
                      <td className="px-4 py-4">
                          {machine.statusChangeDate ? new Date(machine.statusChangeDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          <span className="block text-[9px] text-brand-muted">{machine.lastStatusChangeTime || ''}</span>
                      </td>
                      <td className="px-4 py-4 text-center font-black text-brand-light bg-black/20 rounded-lg">{durationString}</td>
                      <td className="px-4 py-4 italic">{getMotivo(machine, maintenanceTasks)}</td>
                      <td className="px-4 py-4 text-center font-bold">{machine.releaseForecastDate ? new Date(machine.releaseForecastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${machine.responsavel === 'Central' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {machine.responsavel || '-'}
                          </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button onClick={() => onOpenOficinaEditModal(machine)} className="p-2 text-brand-accent hover:bg-brand-accent/10 rounded transition-colors" title="Editar detalhes da oficina">
                          <PencilIcon className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>);
        })}
              {sortedMachines.length === 0 && (<tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-brand-muted italic bg-brand-primary/30">Pátio da oficina vazio. Todos os equipamentos estão em campo.</td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. VISÃO GERAL DA FROTA (LEITURA) */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-slate-500">
          <h3 className="text-lg font-black text-brand-light mb-4 uppercase tracking-tighter">Visão Geral da Frota (Leitura)</h3>
          <MachineList machines={allMachines} maintenanceTasks={maintenanceTasks} viewMode="oficina" readOnly={true} onAddHorimetro={() => { }} onSelectMachine={onSelectMachine}/>
      </div>

      {/* 5. ACTIVITY TIMELINE */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-brand-light mb-6 flex items-center gap-2 uppercase tracking-tighter">
              <HistoryIcon className="w-6 h-6 text-blue-400"/>
              Linha do Tempo de Atividades
          </h3>
          <WorkshopActivityTimeline machines={allMachines} limit={10} activityFeed={notifications}/>
      </div>

      {/* FLOATING MACHINE STATUS MENU */}
      {openStatusPopoverId && (<div ref={popoverRef} className="fixed z-[100] w-48 max-h-[70vh] overflow-y-auto bg-brand-primary border border-slate-600 rounded-lg shadow-2xl p-1 animate-in zoom-in-95 duration-100" style={{ top: `${popoverCoords.top}px`, left: `${popoverCoords.left}px`, transform: 'translateX(-50%)' }}>
              <div className="py-1.5 px-3 mb-1 border-b border-slate-700">
                  <p className="text-[9px] font-black text-brand-muted uppercase tracking-widest">Mudar Status</p>
              </div>
              {Object.values(MachineStatus).map(status => (<button key={status} onClick={() => { onUpdateMachineStatus(openStatusPopoverId, status); setOpenStatusPopoverId(null); }} className={`w-full text-left px-3 py-2.5 text-[10px] font-black uppercase rounded-md transition-all flex items-center justify-between group ${allMachines.find(m => m.id === openStatusPopoverId)?.status === status
                    ? 'bg-brand-accent text-brand-primary shadow-lg'
                    : 'text-brand-muted hover:bg-slate-700 hover:text-brand-light'}`}>
                      {status}
                      {allMachines.find(m => m.id === openStatusPopoverId)?.status === status && <CheckCircleIcon className="w-3.5 h-3.5"/>}
                  </button>))}
          </div>)}
    </div>);
};
export default OficinaView;
