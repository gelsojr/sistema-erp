import React from 'react';
import { MachineStatus } from '../types';
import { CogIcon, AdjustableWrenchIcon, CheckCircleIcon } from './icons';
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
const calculateDaysStopped = (statusChangeDate, lastStatusChangeTime) => {
    const totalHours = calculateWorkingHours(statusChangeDate, lastStatusChangeTime || '00:00');
    return Math.floor(totalHours / 9);
};
const OficinaSummary = ({ machines, maintenanceTasks, recentlyReleasedMachines = [] }) => {
    if (machines.length === 0 && recentlyReleasedMachines.length === 0) {
        return (<div className="flex flex-col items-center justify-center h-full min-h-[150px] text-center text-brand-muted">
        <CogIcon className="w-10 h-10 mb-2"/>
        <p>Nenhuma máquina no pátio da oficina.</p>
      </div>);
    }
    // Sort machines by days stopped, descending
    const sortedMachines = [...machines].sort((a, b) => {
        const daysA = calculateDaysStopped(a.statusChangeDate, a.lastStatusChangeTime);
        const daysB = calculateDaysStopped(b.statusChangeDate, b.lastStatusChangeTime);
        return daysB - daysA;
    });
    return (<div className="space-y-3 flex-1 overflow-y-auto pr-2">
      {/* Recently Released Machines Section */}
      {recentlyReleasedMachines.map(machine => (<div key={machine.id} className="flex items-center p-3 rounded-lg gap-3 bg-green-500/20 border border-green-500/40 animate-pulse">
             <div className="p-2 rounded-full mt-1 shrink-0 bg-green-500/30">
                 <CheckCircleIcon className="w-5 h-5 text-green-400"/>
             </div>
             <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                      <p className="font-semibold text-brand-light truncate">{machine.prefix} - {machine.name}</p>
                      <span className="text-xs text-green-300 font-bold bg-green-900/40 px-2 py-1 rounded">
                          Liberado da Oficina
                      </span>
                  </div>
                  <p className="text-sm text-green-200 mt-1">
                      Concluído em: <strong>{machine.statusChangeDate ? new Date(machine.statusChangeDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje'}</strong> às <strong>{machine.lastStatusChangeTime || '--:--'}</strong>
                  </p>
             </div>
          </div>))}

      {/* Existing Stopped Machines */}
      {sortedMachines.map(machine => {
            const isMechanicalProblem = machine.status === MachineStatus.MechanicalProblem;
            const daysStopped = calculateDaysStopped(machine.statusChangeDate, machine.lastStatusChangeTime);
            let bgClass = "bg-brand-primary hover:bg-slate-700";
            if (daysStopped > 20) {
                bgClass = "bg-red-900/50 hover:bg-red-800/50 border border-red-700/50";
            }
            else if (daysStopped > 10) {
                bgClass = "bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40";
            }
            return (<div key={machine.id} className={`flex items-start p-3 rounded-lg transition-colors gap-3 ${bgClass}`}>
            <div className={`p-2 rounded-full mt-1 shrink-0 ${isMechanicalProblem ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                {isMechanicalProblem ? (<AdjustableWrenchIcon className="w-5 h-5 text-red-400"/>) : (<CogIcon className="w-5 h-5 text-yellow-400"/>)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <p className="font-semibold text-brand-light truncate" title={`${machine.prefix} - ${machine.name} ${machine.model}`}>{machine.prefix} - {machine.name} {machine.model}</p>
                  <span className="text-sm font-bold font-mono bg-black/20 px-2 py-0.5 rounded text-brand-muted whitespace-nowrap">{daysStopped} dias</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-brand-muted mt-1">
                  <p><strong className="text-brand-light/80 font-medium">Parado desde:</strong> {machine.statusChangeDate ? new Date(machine.statusChangeDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</p>
                  <p><strong className="text-brand-light/80 font-medium">Previsão:</strong> {machine.releaseForecastDate ? new Date(machine.releaseForecastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                  <p><strong className="text-brand-light/80 font-medium">Situação:</strong> {machine.situation || '-'}</p>
                  <p className="col-span-1 sm:col-span-3 truncate" title={getMotivo(machine, maintenanceTasks)}><strong className="text-brand-light/80 font-medium">Motivo:</strong> {getMotivo(machine, maintenanceTasks)}</p>
              </div>
            </div>
          </div>);
        })}
    </div>);
};
export default OficinaSummary;
