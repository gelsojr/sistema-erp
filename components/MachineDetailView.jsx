import React, { useState, useMemo } from 'react';
import { MachineStatus } from '../types';
import { ArrowLeftIcon, ChartIcon, WrenchIcon, FuelIcon, ClockIcon, DropIcon, PrinterIcon, XMarkIcon } from './icons';
import MetricCard from './MetricCard';
import StatusBadge from './StatusBadge';
import MachineTimeline from './MachineTimeline';
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getFirstDayOfMonthStr = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
const MachineDetailView = ({ machine, onBack }) => {
    const [startDate, setStartDate] = useState(getFirstDayOfMonthStr());
    const [endDate, setEndDate] = useState(getTodayStr());
    const [isReportOpen, setReportOpen] = useState(false);
    // --- LIFETIME TOTAL FUEL CALCULATION ---
    const totalFuelLifetime = useMemo(() => {
        const supplyLogs = machine.supplyLogs || [];
        const fuelLogs = machine.fuelLogs || [];
        let total = 0;
        if (supplyLogs.length > 0) {
            total = supplyLogs.reduce((acc, log) => acc + (log.diesel || 0), 0);
        }
        else {
            total = fuelLogs.reduce((acc, log) => acc + (log.liters || 0), 0);
        }
        return total;
    }, [machine]);
    // --- RANGE SUMMARY CALCULATIONS ---
    const rangeStats = useMemo(() => {
        if (!startDate || !endDate)
            return null;
        // 1. Calculate Worked Hours in Range
        const readingsSorted = [...machine.readings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Find latest reading within or before range to get a starting point
        const readingsBeforeRange = readingsSorted.filter(r => r.date < startDate);
        const startValue = readingsBeforeRange.length > 0
            ? readingsBeforeRange[readingsBeforeRange.length - 1].value
            : (readingsSorted.length > 0 ? readingsSorted[0].value : 0);
        const readingsInRange = readingsSorted.filter(r => r.date >= startDate && r.date <= endDate);
        const endValue = readingsInRange.length > 0
            ? readingsInRange[readingsInRange.length - 1].value
            : startValue;
        const workedHours = Math.max(0, endValue - startValue);
        // 2. Stopped Hours (Maintenance & Available)
        let hoursMaintenance = 0;
        let hoursAvailable = 0;
        const SHIFT_HOURS = 9;
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const readingsMap = new Map(readingsSorted.map(r => [r.date, r.status]));
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const status = readingsMap.get(dateStr);
            if (status === MachineStatus.Maintenance || status === MachineStatus.MechanicalProblem) {
                hoursMaintenance += SHIFT_HOURS;
            }
            else if (status === MachineStatus.Disponível) {
                hoursAvailable += SHIFT_HOURS;
            }
        }
        // 3. Consumption in Range
        const supplyLogs = machine.supplyLogs || [];
        const rangeLogs = supplyLogs.filter(log => {
            const logDate = log.date.split('T')[0];
            return logDate >= startDate && logDate <= endDate;
        });
        let fuelConsumed = rangeLogs.reduce((acc, log) => acc + (log.diesel || 0), 0);
        let arlaConsumed = rangeLogs.reduce((acc, log) => acc + (log.arla || 0), 0);
        // If no supplyLogs, check legacy fuelLogs
        if (rangeLogs.length === 0 && machine.fuelLogs) {
            fuelConsumed = machine.fuelLogs
                .filter(log => log.date >= startDate && log.date <= endDate)
                .reduce((acc, log) => acc + log.liters, 0);
        }
        const lubricants = {
            engineOil: 0, hydraulicOil: 0, transmissionOil: 0, differentialOil: 0,
            grease: 0, filters: {}
        };
        rangeLogs.forEach(log => {
            if (log.lubrication) {
                if (log.lubrication.grease)
                    lubricants.grease += 1;
                if (log.lubrication.engineOil)
                    lubricants.engineOil += log.lubrication.engineOil.amount;
                if (log.lubrication.hydraulicOil)
                    lubricants.hydraulicOil += log.lubrication.hydraulicOil.amount;
                if (log.lubrication.transmissionOil)
                    lubricants.transmissionOil += log.lubrication.transmissionOil.amount;
                if (log.lubrication.differentialOil)
                    lubricants.differentialOil += log.lubrication.differentialOil.amount;
                log.lubrication.filters.forEach(f => {
                    lubricants.filters[f.name] = (lubricants.filters[f.name] || 0) + f.quantity;
                });
            }
        });
        const consumptionAvg = workedHours > 0 ? (fuelConsumed / workedHours) : 0;
        return {
            workedHours, hoursMaintenance, hoursAvailable,
            fuelConsumed, arlaConsumed, consumptionAvg, lubricants,
            readingsCount: readingsInRange.length,
            logsCount: rangeLogs.length
        };
    }, [machine, startDate, endDate]);
    return (<div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-brand-muted hover:text-brand-light transition-colors p-2 rounded-full bg-brand-secondary">
                        <ArrowLeftIcon />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-brand-light">
                            <span className="font-semibold text-brand-accent mr-2">{machine.prefix}</span>
                            {machine.name} {machine.model}
                        </h2>
                        <p className="text-brand-muted">{machine.brand}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard title="Horas totais trabalhada" value={machine.hours.toLocaleString('pt-BR')} icon={<ChartIcon className="w-8 h-8"/>} color="text-blue-400"/>
                <MetricCard title="Horas no Mês (Atual)" value={(machine.monthlyHours ?? 0).toString()} icon={<ChartIcon className="w-8 h-8"/>} color="text-indigo-400"/>
                 <MetricCard title="Abastecimento Total (Vida)" value={`${totalFuelLifetime.toLocaleString('pt-BR')} L`} icon={<FuelIcon className="w-8 h-8"/>} color="text-orange-400"/>
            </div>

            {/* PERFORMANCE ANALYSIS CARD */}
            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-brand-accent">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent/20 p-2 rounded-lg">
                            <ChartIcon className="w-6 h-6 text-brand-accent"/>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-brand-light">Resumo de Performance por Período</h3>
                            <p className="text-xs text-brand-muted uppercase tracking-widest font-bold">Análise de Eficiência Operacional</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-3 bg-brand-primary p-3 rounded-xl border border-slate-700 shadow-inner w-full xl:w-auto">
                        <div className="flex-1 sm:flex-initial">
                            <label className="block text-[10px] font-black text-brand-muted uppercase mb-1 ml-1">Início</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-brand-secondary text-brand-light border border-slate-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent w-full"/>
                        </div>
                        <div className="flex-1 sm:flex-initial">
                            <label className="block text-[10px] font-black text-brand-muted uppercase mb-1 ml-1">Fim</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-brand-secondary text-brand-light border border-slate-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent w-full"/>
                        </div>
                        <button onClick={() => setReportOpen(true)} className="bg-brand-accent hover:bg-amber-400 text-brand-primary font-black px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 h-[36px] w-full sm:w-auto justify-center">
                            <PrinterIcon className="w-4 h-4"/>
                            Visualizar Relatório
                        </button>
                    </div>
                </div>

                {rangeStats ? (<div className="space-y-6">
                        {/* Hours & Fuel */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-brand-primary p-4 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                                <span className="block text-[10px] text-brand-muted uppercase font-black mb-1">Horas Trabalhadas</span>
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-5 h-5 text-green-400"/>
                                    <span className="text-2xl font-bold text-brand-light">{rangeStats.workedHours.toFixed(1)} h</span>
                                </div>
                            </div>
                            <div className="bg-brand-primary p-4 rounded-lg border border-slate-700">
                                <span className="block text-[10px] text-brand-muted uppercase font-black mb-1">Horas Oficina</span>
                                <div className="flex items-center gap-2">
                                    <WrenchIcon className="w-5 h-5 text-red-400"/>
                                    <span className="text-2xl font-bold text-brand-light">{rangeStats.hoursMaintenance} h</span>
                                </div>
                            </div>
                            <div className="bg-brand-primary p-4 rounded-lg border border-slate-700">
                                <span className="block text-[10px] text-brand-muted uppercase font-black mb-1">Horas Disponível</span>
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-5 h-5 text-blue-400"/>
                                    <span className="text-2xl font-bold text-brand-light">{rangeStats.hoursAvailable} h</span>
                                </div>
                            </div>
                            <div className="bg-brand-primary p-4 rounded-lg border border-slate-700">
                                <span className="block text-[10px] text-brand-muted uppercase font-black mb-1">Diesel Consumido</span>
                                <div className="flex items-center gap-2">
                                    <FuelIcon className="w-5 h-5 text-yellow-500"/> 
                                    <span className="text-2xl font-bold text-brand-light">{rangeStats.fuelConsumed.toLocaleString('pt-BR')} L</span>
                                </div>
                                <span className={`text-[10px] font-bold mt-1 block ${rangeStats.consumptionAvg > 20 ? 'text-red-400' : 'text-green-400'}`}>
                                    Média: {rangeStats.consumptionAvg.toFixed(2)} L/h
                                </span>
                            </div>
                        </div>

                        {/* Detailed Supply Consumption */}
                        <div className="border-t border-slate-700 pt-6">
                            <h4 className="text-sm font-bold text-brand-light uppercase mb-4 flex items-center gap-2">
                                <DropIcon className="w-4 h-4 text-purple-400"/>
                                Consumo de Insumos no Período
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-brand-primary p-3 rounded-lg border border-slate-700 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-brand-muted">Arla 32</span>
                                        <span className="font-bold text-blue-300">{rangeStats.arlaConsumed} L</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-brand-muted">Óleo Motor</span>
                                        <span className="font-bold text-yellow-200">{rangeStats.lubricants.engineOil} L</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-brand-muted">Óleo Hidráulico</span>
                                        <span className="font-bold text-orange-300">{rangeStats.lubricants.hydraulicOil} L</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-t border-slate-600 pt-1">
                                        <span className="text-brand-muted">Aplicação Graxa</span>
                                        <span className="font-bold text-green-300">{rangeStats.lubricants.grease} un</span>
                                    </div>
                                </div>

                                <div className="lg:col-span-3 bg-brand-primary p-3 rounded-lg border border-slate-700">
                                    <p className="text-xs text-brand-muted uppercase mb-2 font-bold">Filtros Substituídos</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(rangeStats.lubricants.filters).map(([name, qty]) => (<span key={name} className="px-3 py-1 bg-slate-700 rounded-full border border-slate-600 text-xs font-semibold text-brand-light flex items-center gap-2">
                                                {name}
                                                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-brand-accent">{qty}</span>
                                            </span>))}
                                        {Object.keys(rangeStats.lubricants.filters).length === 0 && (<span className="text-xs text-brand-muted italic">Nenhum filtro trocado no intervalo.</span>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>) : (<div className="text-center py-8 text-brand-muted italic bg-brand-primary rounded-lg border border-slate-700 border-dashed">
                        Selecione um intervalo válido para análise.
                    </div>)}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold text-brand-light mb-4">Histórico de Leituras</h3>
                    <div className="overflow-y-auto max-h-96 pr-2">
                        <table className="min-w-full text-sm text-left text-brand-muted">
                            <thead className="bg-brand-primary text-xs uppercase sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Data</th>
                                    <th scope="col" className="px-6 py-3">Leitura</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-brand-secondary">
                                {[...machine.readings].reverse().map(reading => (<tr key={reading.date} className="border-b border-brand-primary">
                                        <td className="px-6 py-4">{new Date(reading.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 font-medium text-brand-light">{reading.value.toLocaleString('pt-BR')}</td>
                                        <td className="px-6 py-4">
                                            {reading.status ? <StatusBadge status={reading.status}/> : <span className="text-xs text-brand-muted">N/D</span>}
                                        </td>
                                    </tr>))}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold text-brand-light mb-4">Linha do Tempo</h3>
                    <div className="overflow-y-auto max-h-96 pr-2">
                        <MachineTimeline machine={machine}/>
                    </div>
                </div>
            </div>

            {/* REPORT PREVIEW MODAL */}
            {isReportOpen && (<div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 transition-all">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-slate-100 px-8 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <PrinterIcon className="w-6 h-6 text-brand-logo"/>
                                    Relatório de Eficiência Operacional
                                </h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Documento Técnico - Construtora Perfil</p>
                            </div>
                            <button onClick={() => setReportOpen(false)} className="text-slate-400 hover:text-brand-logo p-2 rounded-full transition-all">
                                <XMarkIcon className="w-8 h-8"/>
                            </button>
                        </div>

                        {/* Report Content */}
                        <div className="p-10 overflow-y-auto flex-1 bg-white text-slate-800 scroll-smooth">
                            {/* Brand & Machine Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b-4 border-brand-logo pb-6">
                                <div className="bg-brand-logo p-4 rounded-xl text-white flex flex-col items-center justify-center shadow-lg mb-4 md:mb-0">
                                    <span className="text-[8px] font-bold tracking-[0.2em] uppercase leading-none mb-0.5">Construtora</span>
                                    <span className="text-3xl font-black italic tracking-tighter leading-none">PERFIL</span>
                                </div>
                                <div className="text-right">
                                    <h3 className="text-4xl font-black text-slate-900 leading-none mb-1">{machine.prefix}</h3>
                                    <p className="text-xl font-bold text-slate-600">{machine.name} {machine.model}</p>
                                    <p className="text-sm text-slate-400 font-medium">{machine.brand} | Placa: {machine.plate || 'N/A'}</p>
                                    {/* ADDED: Current Hourmeter below plate as requested */}
                                    <p className="text-xs font-black text-brand-logo mt-1.5 uppercase tracking-tighter bg-slate-100 inline-block px-2 py-0.5 rounded border border-slate-200">Horímetro Atual: {machine.hours.toLocaleString('pt-BR')} h</p>
                                </div>
                            </div>

                            {/* Data Interval Info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Período Analisado</span>
                                    <p className="text-sm font-bold text-slate-700">
                                        {new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} <br />
                                        <span className="text-[10px] text-slate-400 lowercase">até</span> <br />
                                        {new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Horas Trabalhadas</span>
                                    <p className="text-2xl font-black text-slate-800">{rangeStats?.workedHours.toFixed(1)} h</p>
                                    <span className="text-[10px] text-slate-400">No período selecionado</span>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Consumo Médio</span>
                                    <p className="text-2xl font-black text-brand-logo">{rangeStats?.consumptionAvg.toFixed(2)} <span className="text-xs">L/h</span></p>
                                    <span className={`text-[9px] font-bold ${rangeStats?.consumptionAvg > 20 ? 'text-red-500' : 'text-green-600'}`}>
                                        {rangeStats?.consumptionAvg > 20 ? 'Consumo Acima da Média' : 'Consumo Otimizado'}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Total Diesel</span>
                                    <p className="text-2xl font-black text-blue-600">{rangeStats?.fuelConsumed.toLocaleString('pt-BR')} <span className="text-xs">L</span></p>
                                    <span className="text-[10px] text-slate-400">Volume total abastecido</span>
                                </div>
                            </div>

                            {/* Main Body Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {/* Left Side: Logistics & Maintenance */}
                                <div className="space-y-8">
                                    <section>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-logo"></div>
                                            Consumo Detalhado de Insumos
                                        </h4>
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-sm font-medium text-slate-600">Arla 32</span>
                                                    <span className="font-black text-blue-600">{rangeStats?.arlaConsumed} L</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-sm font-medium text-slate-600">Óleo Motor (Troca/Comp.)</span>
                                                    <span className="font-black text-slate-800">{rangeStats?.lubricants.engineOil} L</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                                    <span className="text-sm font-medium text-slate-600">Lubrificação (Graxa)</span>
                                                    <span className="font-black text-slate-800">{rangeStats?.lubricants.grease} Aplicações</span>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-6">
                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Filtros Trocados no Período</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(rangeStats?.lubricants.filters || {}).map(([name, qty]) => (<div key={name} className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                                                            <span className="text-xs font-bold text-slate-700">{name}</span>
                                                            <span className="bg-slate-100 text-brand-logo px-1.5 py-0.5 rounded text-[10px] font-black">{qty}</span>
                                                        </div>))}
                                                    {Object.keys(rangeStats?.lubricants.filters || {}).length === 0 && (<p className="text-xs text-slate-400 italic">Nenhum item registrado.</p>)}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-logo"></div>
                                            Disponibilidade Mecânica
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                                <span className="text-[10px] font-black text-red-400 uppercase block mb-1">Horas Paradas (Oficina)</span>
                                                <p className="text-2xl font-black text-red-600">{rangeStats?.hoursMaintenance} h</p>
                                            </div>
                                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                                                <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">Horas Disponível (Pátio)</span>
                                                <p className="text-2xl font-black text-blue-600">{rangeStats?.hoursAvailable} h</p>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Right Side: Readings & Efficiency Chart/Table */}
                                <div className="space-y-8">
                                    <section>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-logo"></div>
                                            Extrato de Movimentação (Horímetro)
                                        </h4>
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-900 text-white font-black uppercase text-[9px]">
                                                    <tr>
                                                        <th className="p-3 text-left">Data do Registro</th>
                                                        <th className="p-3 text-left">Leitura</th>
                                                        <th className="p-3 text-left">Status</th>
                                                        <th className="p-3 text-right">Var. Dia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {machine.readings.filter(r => r.date >= startDate && r.date <= endDate).map((r, idx, arr) => {
                const prev = arr[idx - 1];
                const diff = prev ? r.value - prev.value : 0;
                return (<tr key={r.date} className="hover:bg-slate-50 transition-colors">
                                                                <td className="p-3 font-medium text-slate-500">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                                                <td className="p-3 font-black text-slate-800">{r.value.toFixed(1)}</td>
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.status === MachineStatus.Operating ? 'bg-green-100 text-green-700' :
                        r.status === MachineStatus.Maintenance ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                                                                </td>
                                                                <td className="p-3 text-right font-bold text-slate-400">+{diff.toFixed(1)}</td>
                                                            </tr>);
            }).reverse()}
                                                    {machine.readings.filter(r => r.date >= startDate && r.date <= endDate).length === 0 && (<tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">Nenhum registro de leitura no período.</td></tr>)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>
                            </div>
                            
                            {/* Footer / Signature Area */}
                            <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-20">
                                <div className="text-center border-t border-slate-300 pt-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Responsável pela Frota</p>
                                    <p className="text-sm font-bold text-slate-600 italic">Assinatura Digital - PERFIL</p>
                                </div>
                                <div className="text-center border-t border-slate-300 pt-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Analista de Planejamento</p>
                                    <p className="text-sm font-bold text-slate-600 italic">Assinatura Digital - PERFIL</p>
                                </div>
                            </div>

                            <div className="mt-10 text-center text-[9px] text-slate-300 font-bold uppercase tracking-[0.3em]">
                                Emitido via Sistema de Gestão Perfil Oficina em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                            </div>
                        </div>

                        {/* Modal Footer Controls */}
                        <div className="bg-slate-100 px-10 py-6 border-t border-slate-200 flex justify-end gap-6 shrink-0 shadow-inner">
                            <button onClick={() => setReportOpen(false)} className="px-8 py-3 bg-white border border-slate-300 text-slate-700 font-black rounded-xl shadow-sm hover:bg-slate-50 transition-all uppercase tracking-widest text-xs">Fechar</button>
                            <button onClick={() => window.print()} className="px-8 py-3 bg-brand-logo text-white font-black rounded-xl shadow-xl hover:brightness-110 transition-all flex items-center gap-3 uppercase tracking-widest text-xs">
                                <PrinterIcon className="w-5 h-5"/> 
                                Imprimir / Salvar PDF
                            </button>
                        </div>
                    </div>
                </div>)}
        </div>);
};
export default MachineDetailView;
