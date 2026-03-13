import React, { useMemo } from 'react';
import { MachineStatus } from '../types';
import { WrenchIcon, AdjustableWrenchIcon, CheckCircleIcon, InfoIcon, ClockIcon, CalendarIcon, CogIcon } from './icons';
const parseForecastChangeFromMessage = (rawMessage) => {
    const message = String(rawMessage || '').replace(/\s+/g, ' ').trim();
    if (!message)
        return null;
    let actorLabel = 'Usuário';
    let content = message;
    const prefixedMatch = message.match(/^(.+?):\s(.+)$/);
    if (prefixedMatch && /Previs[aã]o de libera[cç][aã]o/i.test(prefixedMatch[2])) {
        actorLabel = prefixedMatch[1];
        content = prefixedMatch[2];
    }
    const match = content.match(/Previs[aã]o de libera[cç][aã]o do\s+(.+?)\s+alterada de\s+(.+?)\s+para\s+(.+?)\.?$/i);
    if (!match) {
        return null;
    }
    return {
        actorLabel,
        machinePrefix: match[1],
        fromLabel: match[2],
        toLabel: match[3]
    };
};
const parseForecastChangeFromItem = (item) => {
    const metadata = item?.metadata || item?.context || {};
    if (metadata?.event === 'forecast_update') {
        const machinePrefix = String(metadata.machinePrefix || '').trim();
        if (!machinePrefix) {
            return null;
        }
        const actorName = item?.actorName || 'Usuário';
        const actorRole = item?.actorRole ? ` (${item.actorRole})` : '';
        return {
            actorLabel: `${actorName}${actorRole}`,
            machinePrefix,
            fromLabel: metadata.fromLabel || 'sem previsão',
            toLabel: metadata.toLabel || 'sem previsão'
        };
    }
    return parseForecastChangeFromMessage(item?.message);
};
const WorkshopActivityTimeline = ({ machines, limit = 10, activityFeed = [] }) => {
    const formatDuration = (startDate, startTime, endDate, endTime) => {
        if (!startDate || !endDate)
            return '';
        try {
            const start = new Date(`${startDate}T${startTime || '00:00'}:00`);
            const end = new Date(`${endDate}T${endTime || '00:00'}:00`);
            const diffMs = end.getTime() - start.getTime();
            if (diffMs <= 0)
                return '';
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
            if (remMins > 0 || parts.length === 0)
                parts.push(`${remMins}min`);
            return parts.join(', ');
        }
        catch (e) {
            return '';
        }
    };
    const events = useMemo(() => {
        const allEvents = [];
        machines.forEach(m => {
            // 1. Entradas e Saídas (Histórico de Oficina)
            m.stoppageHistory?.forEach(s => {
                // Verifica se é a parada atual (ativa) para exibir a situação
                const isCurrentStoppage = !s.endDate && (m.status === MachineStatus.Maintenance || m.status === MachineStatus.MechanicalProblem);
                const currentSituation = isCurrentStoppage ? m.situation : undefined;
                allEvents.push({
                    date: new Date(s.startDate + 'T00:00:00'),
                    time: s.startTime,
                    type: 'entry',
                    machinePrefix: m.prefix,
                    machineName: m.name,
                    description: `Entrou na oficina: ${s.reason}`,
                    situation: currentSituation,
                    statusReason: s.reason // Passa o motivo (Status) para controlar o ícone
                });
                if (s.endDate) {
                    allEvents.push({
                        date: new Date(s.endDate + 'T00:00:00'),
                        time: s.endTime,
                        type: 'exit',
                        machinePrefix: m.prefix,
                        machineName: m.name,
                        description: 'Manutenção concluída e liberada',
                        durationText: `Tempo no pátio: ${formatDuration(s.startDate, s.startTime, s.endDate, s.endTime)}`
                    });
                }
            });
            // 2. Solicitações de Campo Pendentes
            m.pendingIssues?.forEach(issue => {
                allEvents.push({
                    date: new Date(issue.date + 'T00:00:00'),
                    time: issue.time,
                    type: 'issue',
                    machinePrefix: m.prefix,
                    machineName: m.name,
                    description: `Solicitação em campo: ${issue.description}`
                });
            });
            // 3. Solicitações Resolvidas
            m.resolvedIssues?.forEach(issue => {
                allEvents.push({
                    date: new Date(issue.originalDate + 'T00:00:00'),
                    time: issue.originalTime,
                    type: 'issue',
                    machinePrefix: m.prefix,
                    machineName: m.name,
                    description: `Histórico: Solicitado em campo - ${issue.description}`
                });
                allEvents.push({
                    date: new Date(issue.resolvedDate + 'T00:00:00'),
                    time: issue.resolvedTime,
                    type: 'resolution',
                    machinePrefix: m.prefix,
                    machineName: m.name,
                    description: `Resolvido em campo: ${issue.description}`,
                    durationText: `Atendido em: ${formatDuration(issue.originalDate, issue.originalTime, issue.resolvedDate, issue.resolvedTime)}`
                });
            });
        });
        (activityFeed || []).forEach((item) => {
            const parsed = parseForecastChangeFromItem(item);
            if (!parsed) {
                return;
            }
            const machine = machines.find((m) => String(m.prefix || '').toLowerCase() === String(parsed.machinePrefix || '').toLowerCase());
            const candidateTimestamp = item?.timestamp ? new Date(item.timestamp) : new Date();
            const timestamp = Number.isNaN(candidateTimestamp.getTime()) ? new Date() : candidateTimestamp;
            allEvents.push({
                id: item?.id || `forecast-${parsed.machinePrefix}-${timestamp.toISOString()}`,
                date: timestamp,
                time: timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                type: 'forecast_update',
                machinePrefix: parsed.machinePrefix,
                machineName: machine?.name || 'Equipamento',
                description: `${parsed.actorLabel} mudou previsão de liberação de ${parsed.fromLabel} para ${parsed.toLabel}.`
            });
        });
        return allEvents
            .sort((a, b) => {
            const dateDiff = b.date.getTime() - a.date.getTime();
            if (dateDiff !== 0)
                return dateDiff;
            return (b.time || '00:00').localeCompare(a.time || '00:00');
        })
            .slice(0, limit);
    }, [activityFeed, machines, limit]);
    if (events.length === 0) {
        return <p className="text-center py-12 text-brand-muted italic text-sm border border-dashed border-slate-700 rounded-xl bg-brand-primary/20">Sem atividades recentes registradas.</p>;
    }
    const getStyle = (event) => {
        switch (event.type) {
            case 'entry':
                if (event.statusReason === MachineStatus.MechanicalProblem) {
                    return {
                        icon: <AdjustableWrenchIcon className="w-3.5 h-3.5"/>,
                        color: 'bg-red-500',
                        text: 'text-red-500',
                        border: 'border-red-500/20'
                    };
                }
                // Default: Manutenção
                return {
                    icon: <CogIcon className="w-3.5 h-3.5"/>,
                    color: 'bg-yellow-500',
                    text: 'text-yellow-500',
                    border: 'border-yellow-500/20'
                };
            case 'exit': return { icon: <CheckCircleIcon className="w-3.5 h-3.5"/>, color: 'bg-green-500', text: 'text-green-500', border: 'border-green-500/20' };
            case 'issue': return { icon: <InfoIcon className="w-3.5 h-3.5"/>, color: 'bg-red-500', text: 'text-red-500', border: 'border-red-500/20' };
            case 'resolution': return { icon: <ClockIcon className="w-3.5 h-3.5"/>, color: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500/20' };
            case 'forecast_update': return { icon: <CalendarIcon className="w-3.5 h-3.5"/>, color: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/20' };
            default: return { icon: <WrenchIcon className="w-3.5 h-3.5"/>, color: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-500/20' };
        }
    };
    return (<div className="flex flex-col gap-4 relative">
      {events.map((event, idx) => {
            const style = getStyle(event);
            return (<div key={idx} className="flex gap-4 items-center relative animate-in fade-in slide-in-from-left-2 duration-300">
            {/* Ícone de status à esquerda */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.color} bg-opacity-20 ${style.text} shadow-sm border ${style.border}`}>
              {style.icon}
            </div>

            {/* Conteúdo do Card empilhado horizontalmente com informações internas verticais */}
            <div className="flex-1 min-w-0 bg-brand-primary/40 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/30 transition-all group shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${style.text}`}>{event.machinePrefix}</span>
                  <span className="text-slate-500 opacity-30">|</span>
                  <p className="text-xs text-brand-light font-black truncate group-hover:text-brand-accent transition-colors uppercase tracking-tight">{event.machineName}</p>
                </div>
                <p className="text-[11px] text-brand-muted leading-relaxed italic break-words">{event.description}</p>
                
                {/* EXIBIÇÃO DA SITUAÇÃO DA OFICINA */}
                {event.situation && (<div className="mt-2 flex items-center gap-2">
                        <div className="px-2 py-1 bg-slate-800/80 border border-slate-600 rounded flex items-center gap-1.5">
                            {/* Renderização Condicional do Ícone baseada no Motivo (Status) */}
                            {event.statusReason === MachineStatus.MechanicalProblem ? (<AdjustableWrenchIcon className="w-3 h-3 text-red-400"/>) : (<CogIcon className="w-3 h-3 text-brand-accent animate-spin-slow"/>)}
                            <span className="text-[10px] font-bold text-brand-muted uppercase">Situação:</span>
                            <span className="text-[10px] font-black text-brand-light uppercase tracking-wide">{event.situation}</span>
                        </div>
                    </div>)}
              </div>

              <div className="flex flex-col md:items-end shrink-0 gap-1.5">
                <span className="text-[10px] text-brand-muted font-mono bg-brand-secondary/50 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-700 self-start md:self-auto">
                  <CalendarIcon className="w-2.5 h-2.5"/>
                  {event.date.toLocaleDateString('pt-BR')} 
                  <span className="opacity-40 font-bold">|</span>
                  <ClockIcon className="w-2.5 h-2.5 ml-0.5"/>
                  {event.time || '--:--'}
                </span>
                
                {event.durationText && (<div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/50 md:border-t-0 md:pt-0">
                        <div className={`h-1.5 w-1.5 rounded-full ${style.color}`}></div>
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${style.text} opacity-90`}>
                            {event.durationText}
                        </span>
                    </div>)}
              </div>
            </div>
          </div>);
        })}
    </div>);
};
export default WorkshopActivityTimeline;
