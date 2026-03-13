import React, { useMemo } from 'react';
import { MachineStatus } from '../types';
import { WrenchIcon, AdjustableWrenchIcon, CheckCircleIcon, ChartIcon, InfoIcon, FuelIcon, ClockIcon } from './icons';
const getIconForEvent = (status) => {
    switch (status) {
        case MachineStatus.MechanicalProblem:
            return { Icon: AdjustableWrenchIcon, color: 'text-red-400', bgColor: 'bg-red-500/20' };
        case MachineStatus.Maintenance:
            return { Icon: WrenchIcon, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
        case 'Resumed':
            return { Icon: CheckCircleIcon, color: 'text-green-400', bgColor: 'bg-green-500/20' };
        case 'ResolvedIssue':
            return { Icon: CheckCircleIcon, color: 'text-green-400', bgColor: 'bg-green-500/20' };
        case 'Production':
            return { Icon: ChartIcon, color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
        case 'Observation':
            return { Icon: InfoIcon, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' };
        case 'Supply':
            return { Icon: FuelIcon, color: 'text-purple-400', bgColor: 'bg-purple-500/20' };
        default:
            return { Icon: WrenchIcon, color: 'text-brand-muted', bgColor: 'bg-slate-600/20' };
    }
};
const formatDuration = (startDate, startTime, endDate, endTime) => {
    if (!startDate || !endDate)
        return '';
    try {
        const start = new Date(`${startDate}T${startTime || '00:00'}:00`);
        const end = new Date(`${endDate}T${endTime || '00:00'}:00`);
        const diffMs = end.getTime() - start.getTime();
        if (diffMs <= 0)
            return 'Menos de 1 min';
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHrs = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);
        const remHrs = diffHrs % 24;
        const remMins = diffMins % 60;
        const parts = [];
        if (diffDays > 0)
            parts.push(`${diffDays} dia(s)`);
        if (remHrs > 0)
            parts.push(`${remHrs}h`);
        if (remMins > 0)
            parts.push(`${remMins}min`);
        return parts.length > 0 ? parts.join(' ') : 'Menos de 1 min';
    }
    catch (e) {
        return '';
    }
};
const MachineTimeline = ({ machine }) => {
    const timelineEvents = useMemo(() => {
        const events = [];
        // 1. Process Stoppage History (Entrada na Oficina)
        const history = machine.stoppageHistory || [];
        history.forEach(stoppage => {
            const startDate = new Date(stoppage.startDate + 'T00:00:00');
            let title = stoppage.reason;
            const description = stoppage.description || `Equipamento parado para ${stoppage.reason.toLowerCase()}.`;
            if (stoppage.reason === MachineStatus.MechanicalProblem) {
                title = 'Entrada na Oficina (Problema Mecânico)';
            }
            else if (stoppage.reason === MachineStatus.Maintenance) {
                title = 'Entrada na Oficina (Manutenção)';
            }
            events.push({
                date: startDate,
                time: stoppage.startTime,
                status: stoppage.reason,
                title: title,
                description: description,
            });
            if (stoppage.endDate) {
                const endDate = new Date(stoppage.endDate + 'T00:00:00');
                const duration = formatDuration(stoppage.startDate, stoppage.startTime, stoppage.endDate, stoppage.endTime);
                events.push({
                    date: endDate,
                    time: stoppage.endTime,
                    status: 'Resumed',
                    title: 'Saída do Pátio (Retorno à Operação)',
                    description: `Manutenção concluída. Equipamento liberado.\nTempo total no pátio: ${duration}`
                });
            }
        });
        // 2. Process Pending Issues (Active Observations)
        if (machine.pendingIssues && machine.pendingIssues.length > 0) {
            machine.pendingIssues.forEach(issue => {
                events.push({
                    date: new Date(issue.date + 'T00:00:00'),
                    time: issue.time,
                    status: 'Observation',
                    title: 'Solicitação de Reparo (Em Campo)',
                    description: `${issue.description} - Reportado por: ${issue.reportedBy || 'Operador'}`
                });
            });
        }
        // 3. Process Resolved Issues (Historical Observations + Resolution Event)
        if (machine.resolvedIssues && machine.resolvedIssues.length > 0) {
            machine.resolvedIssues.forEach(issue => {
                // Event A: The original request (Historical)
                events.push({
                    date: new Date(issue.originalDate + 'T00:00:00'),
                    time: issue.originalTime,
                    status: 'Observation',
                    title: 'Solicitação de Reparo (Histórico)',
                    description: `${issue.description} - Reportado por: ${issue.reportedBy || 'Operador'}`
                });
                // Event B: The resolution
                events.push({
                    date: new Date(issue.resolvedDate + 'T00:00:00'),
                    time: issue.resolvedTime,
                    status: 'ResolvedIssue',
                    title: 'Solicitação Resolvida',
                    description: `Problema resolvido: ${issue.description}`
                });
            });
        }
        // 4. Process Monthly Production (Readings)
        if (machine.readings && machine.readings.length > 0) {
            const sortedReadings = [...machine.readings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            // Group readings by "YYYY-MM"
            const uniqueMonths = Array.from(new Set(sortedReadings.map(r => r.date.substring(0, 7)))).sort();
            const getLastValueBeforeMonth = (monthStr) => {
                const monthIndex = uniqueMonths.indexOf(monthStr);
                if (monthIndex <= 0)
                    return null;
                const prevMonthKey = uniqueMonths[monthIndex - 1];
                const prevMonthReadings = sortedReadings.filter(r => r.date.startsWith(prevMonthKey));
                if (prevMonthReadings.length === 0)
                    return null;
                return prevMonthReadings[prevMonthReadings.length - 1].value;
            };
            uniqueMonths.forEach((month) => {
                const monthReadings = sortedReadings.filter(r => r.date.startsWith(month));
                if (monthReadings.length === 0)
                    return;
                const lastReadingInMonth = monthReadings[monthReadings.length - 1];
                const firstReadingInMonth = monthReadings[0];
                const prevMonthValue = getLastValueBeforeMonth(month);
                const startValue = prevMonthValue !== null ? prevMonthValue : firstReadingInMonth.value;
                const endValue = lastReadingInMonth.value;
                const worked = endValue - startValue;
                const [year, monthNum] = month.split('-').map(Number);
                const lastDayOfMonth = new Date(year, monthNum, 0);
                const today = new Date();
                let eventDate = lastDayOfMonth;
                if (today.getFullYear() === year && today.getMonth() + 1 === monthNum) {
                    eventDate = new Date(lastReadingInMonth.date + 'T12:00:00');
                }
                if (worked >= 0) {
                    const monthName = new Date(year, monthNum - 1, 2).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    const monthNameFormatted = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                    events.push({
                        date: eventDate,
                        time: '18:00', // Approximate end of day
                        status: 'Production',
                        title: `Fechamento Produção: ${monthNameFormatted}`,
                        description: `Horas trabalhadas: ${worked.toLocaleString('pt-BR')}h`
                    });
                }
            });
        }
        // 5. Process Supply Logs (Fuel & Lubrication)
        if (machine.supplyLogs && machine.supplyLogs.length > 0) {
            machine.supplyLogs.forEach(log => {
                const details = [];
                if (log.diesel > 0)
                    details.push(`Diesel: ${log.diesel}L`);
                if (log.arla > 0)
                    details.push(`Arla: ${log.arla}L`);
                if (log.lubrication) {
                    if (log.lubrication.grease)
                        details.push(`Graxa: Sim`);
                    if (log.lubrication.engineOil)
                        details.push(`Motor: ${log.lubrication.engineOil.amount}L`);
                    if (log.lubrication.hydraulicOil)
                        details.push(`Hidráulico: ${log.lubrication.hydraulicOil.amount}L`);
                    if (log.lubrication.transmissionOil)
                        details.push(`Transmissão: ${log.lubrication.transmissionOil.amount}L`);
                    if (log.lubrication.differentialOil)
                        details.push(`Diferencial: ${log.lubrication.differentialOil.amount}L`);
                    if (log.lubrication.filters && log.lubrication.filters.length > 0) {
                        const filterStr = log.lubrication.filters.map(f => `${f.quantity}x ${f.name}`).join(', ');
                        details.push(`Filtros: ${filterStr}`);
                    }
                }
                events.push({
                    date: new Date(log.date), // Assumes ISO string with time
                    time: new Date(log.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    status: 'Supply',
                    title: 'Abastecimento / Lubrificação',
                    description: details.join(' • ')
                });
            });
        }
        if (events.length === 0)
            return [];
        // Sort by Date Descending, then Time Descending
        return events.sort((a, b) => {
            const dateDiff = b.date.getTime() - a.date.getTime();
            if (dateDiff !== 0)
                return dateDiff;
            return (b.time || '').localeCompare(a.time || '');
        });
    }, [machine.stoppageHistory, machine.readings, machine.pendingIssues, machine.resolvedIssues, machine.supplyLogs]);
    if (!timelineEvents || timelineEvents.length === 0) {
        return (<div className="flex items-center justify-center h-full text-center text-brand-muted py-8">
                <p>Nenhum histórico disponível.</p>
            </div>);
    }
    return (<div className="relative border-l-2 border-slate-700 ml-4 py-4">
            {timelineEvents.map((event, index) => {
            const { Icon, color, bgColor } = getIconForEvent(event.status);
            return (<div key={index} className="mb-8 ml-8 relative group">
                        <div className={`absolute -left-11 top-1 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-brand-secondary ${bgColor} transition-transform group-hover:scale-110`}>
                            <Icon className={`w-4 h-4 ${color}`}/>
                        </div>
                        <div className="bg-brand-primary p-4 rounded-lg shadow-md border border-slate-700/50 hover:border-slate-500 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className={`text-sm font-bold ${event.status === 'Resumed' ? 'text-green-400' : color}`}>{event.title}</h3>
                                <time className="text-xs font-mono leading-none text-brand-muted bg-brand-secondary px-2 py-1 rounded flex items-center gap-1 border border-slate-600">
                                    <ClockIcon className="w-3 h-3 text-slate-400"/>
                                    {event.date.toLocaleDateString('pt-BR')} 
                                    <span className="opacity-60 text-[10px] font-bold ml-1">{event.time || ''}</span>
                                </time>
                            </div>
                            <p className="text-xs font-normal text-brand-light mt-2 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                        </div>
                    </div>);
        })}
        </div>);
};
export default MachineTimeline;
