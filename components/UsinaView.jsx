import React, { useState, useMemo, useEffect } from 'react';
import { FactoryIcon, ChartIcon, CubeIcon, PlusIcon, TruckIcon, TrashIcon, ClipboardListIcon, PrinterIcon, XMarkIcon, CogIcon, ArrowUpIcon, ArrowDownIcon } from './icons';
import MetricCard from './MetricCard';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
const LIGANTE_DRAFT_KEY = 'erp_usina_ligante_draft_v1';
const readLiganteDraft = () => {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(LIGANTE_DRAFT_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch (_error) {
        return {};
    }
};
// Componente local para MetricCard com fonte menor no título
const SmallMetricCard = ({ title, value, icon, color }) => {
    return (<div className="bg-brand-secondary p-4 rounded-lg shadow-lg flex items-center space-x-3 transition-transform transform hover:scale-105 overflow-hidden border border-slate-700/50">
      <div className={`p-2.5 rounded-full bg-slate-800/50 shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-brand-muted font-bold uppercase tracking-wider truncate" title={title}>{title}</p>
        <p className="text-lg lg:text-xl font-black text-brand-light truncate leading-tight" title={value}>{value}</p>
      </div>
    </div>);
};
const BituVisualTank3D = ({ label, current, capacity }) => {
    const percentage = Math.max(0, Math.min(100, (current / (capacity || 1)) * 100));
    const criticalThreshold = (capacity || 0) * 0.25;
    const isCritical = current < criticalThreshold;
    return (<div className="flex flex-col items-center p-2 group">
            <h5 className="text-[10px] font-black text-brand-muted uppercase mb-6 tracking-widest">{label}</h5>
            <div className="relative w-full max-w-[240px] h-40 flex items-center justify-center">
                <div className="absolute -bottom-2 w-[90%] h-4 bg-black/40 blur-md rounded-[100%] transition-all duration-700 group-hover:bg-black/60"></div>
                <div className="relative w-48 h-28 bg-slate-300 rounded-[40px/60px] border-b-4 border-slate-500 shadow-2xl overflow-hidden flex items-center justify-center" style={{
            background: 'linear-gradient(180deg, #cbd5e1 0%, #94a3b8 20%, #64748b 50%, #475569 80%, #1e293b 100%)',
            boxShadow: 'inset 0 10px 15px -3px rgba(255, 255, 255, 0.5), inset 0 -10px 15px -3px rgba(0, 0, 0, 0.4)'
        }}>
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] z-10"></div>
                    <div className="absolute bottom-0 left-0 w-full bg-black transition-all duration-1000 ease-out" style={{ height: `${percentage}%`, background: 'linear-gradient(180deg, #1a1a1a 0%, #000000 100%)' }}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-white/20 blur-[1px]"></div>
                    </div>
                    <div className="z-20 text-center">
                        <span className="text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">{Math.round(percentage)}%</span>
                    </div>
                </div>
                <div className="absolute bottom-2 left-10 w-2 h-6 bg-slate-600 rounded-b-sm border-r border-slate-700"></div>
                <div className="absolute bottom-2 right-10 w-2 h-6 bg-slate-600 rounded-b-sm border-l border-slate-700"></div>
            </div>
            <div className="mt-4 text-center">
                <p className={`text-xl font-bold ${isCritical ? 'text-red-400' : 'text-brand-light'}`}>
                    {current.toFixed(1)} <span className="text-xs font-normal opacity-60 italic">/ {capacity.toFixed(0)} t</span>
                </p>
                {isCritical && <div className="mt-2 px-3 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full text-[9px] font-black text-red-400 uppercase animate-pulse">Pedido Urgente</div>}
            </div>
        </div>);
};
const UsinaView = ({ machines, deliveries, setDeliveries, bituDeliveries, setBituDeliveries, productionLogs, setProductionLogs, loadEntries, setLoadEntries, tankCapacities, setTankCapacities }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayStr = new Date().toISOString().slice(0, 8) + '01';
    const liganteDraft = useMemo(() => readLiganteDraft(), []);
    const parseLocaleDecimal = (value) => {
        const normalized = String(value || '').trim().replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    // --- LOCAL FORM STATE ---
    const [newProduct, setNewProduct] = useState('Brita 1');
    const [isCustomProduct, setIsCustomProduct] = useState(false);
    const [newAggregateDate, setNewAggregateDate] = useState(todayStr);
    const [newTons, setNewTons] = useState('');
    const [newTicket, setNewTicket] = useState('');
    const [viewedAggregate, setViewedAggregate] = useState('Total Geral');
    const [showCapacitySettings, setShowCapacitySettings] = useState(false);
    // --- UNIFIED FILTER STATE ---
    const [reportStartDate, setReportStartDate] = useState(firstDayStr);
    const [reportEndDate, setReportEndDate] = useState(todayStr);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isAggregatesReportModalOpen, setIsAggregatesReportModalOpen] = useState(false);
    const [aggregateSortConfig, setAggregateSortConfig] = useState({ key: 'date', direction: 'desc' });
    // --- BITUMINOUS FORM STATE ---
    const [newBituProduct, setNewBituProduct] = useState(liganteDraft.newBituProduct || 'CAP');
    const [newBituDate, setNewBituDate] = useState(liganteDraft.newBituDate || todayStr);
    const [newBituTons, setNewBituTons] = useState(liganteDraft.newBituTons || '');
    const [newBituTicket, setNewBituTicket] = useState(liganteDraft.newBituTicket || '');
    const [newBituPlate, setNewBituPlate] = useState(liganteDraft.newBituPlate || '');
    const [newBituSupplier, setNewBituSupplier] = useState(liganteDraft.newBituSupplier || '');
    const [loadPlate, setLoadPlate] = useState('');
    const [loadTons, setLoadTons] = useState('');
    const [loadTemp, setLoadTemp] = useState('');
    const [prodDate, setProdDate] = useState(todayStr);
    const [prodGross, setProdGross] = useState('');
    const [prodWaste, setProdWaste] = useState('');
    const [prodCap, setProdCap] = useState('');
    const [prodBrita1, setProdBrita1] = useState('');
    const [prodBrita0, setProdBrita0] = useState('');
    const [prodDust, setProdDust] = useState('');
    const [prodInitialHM, setProdInitialHM] = useState('');
    const [prodFinalHM, setProdFinalHM] = useState('');
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(LIGANTE_DRAFT_KEY, JSON.stringify({
            newBituProduct,
            newBituDate,
            newBituTons,
            newBituTicket,
            newBituPlate,
            newBituSupplier
        }));
    }, [newBituDate, newBituPlate, newBituProduct, newBituSupplier, newBituTicket, newBituTons]);
    // --- CALCULATIONS ---
    const totals = useMemo(() => {
        const acc = { 'Brita 1': 0, 'Brita 0': 0, 'Pó de Pedra': 0, 'Pedra Pulmão': 0 };
        deliveries.forEach(d => {
            if (acc[d.product] !== undefined) {
                acc[d.product] += d.tons;
            }
            else {
                acc[d.product] = (acc[d.product] || 0) + d.tons;
            }
        });
        productionLogs.forEach(log => {
            acc['Brita 1'] -= log.brita1Consumed;
            acc['Brita 0'] -= log.brita0Consumed;
            acc['Pó de Pedra'] -= log.stoneDustConsumed;
        });
        return acc;
    }, [deliveries, productionLogs]);
    const selectedAggregateValue = useMemo(() => {
        if (viewedAggregate === 'Total Geral') {
            return Object.values(totals).reduce((a, b) => a + b, 0);
        }
        return totals[viewedAggregate] || 0;
    }, [totals, viewedAggregate]);
    const bituStats = useMemo(() => {
        const stats = {
            'CAP': { in: 0, out: 0, balance: 0 },
            'EAI': { in: 0, out: 0, balance: 0 },
            'RR-2C': { in: 0, out: 0, balance: 0 },
            'RR-1C': { in: 0, out: 0, balance: 0 },
        };
        bituDeliveries.forEach((d) => {
            if (!stats[d.product])
                return;
            const tons = Number(d.tons || 0);
            if (tons >= 0) {
                stats[d.product].in += tons;
            }
            else {
                stats[d.product].out += Math.abs(tons);
            }
        });
        productionLogs.forEach(log => { stats['CAP'].out += log.capConsumed; });
        Object.keys(stats).forEach(key => { stats[key].balance = stats[key].in - stats[key].out; });
        return stats;
    }, [bituDeliveries, productionLogs]);
    const unifiedReportData = useMemo(() => {
        const rangeProduction = productionLogs.filter(p => p.date >= reportStartDate && p.date <= reportEndDate);
        const rangeBituDeliveries = bituDeliveries.filter(d => d.date >= reportStartDate && d.date <= reportEndDate);
        const bituSummary = {
            'CAP': { in: 0, out: 0 }, 'EAI': { in: 0, out: 0 }, 'RR-2C': { in: 0, out: 0 }, 'RR-1C': { in: 0, out: 0 },
        };
        rangeBituDeliveries.forEach((d) => {
            if (!bituSummary[d.product])
                return;
            const tons = Number(d.tons || 0);
            if (tons >= 0) {
                bituSummary[d.product].in += tons;
            }
            else {
                bituSummary[d.product].out += Math.abs(tons);
            }
        });
        rangeProduction.forEach(p => { bituSummary['CAP'].out += p.capConsumed; });
        const prodTotals = rangeProduction.reduce((acc, curr) => ({
            net: acc.net + curr.netCbuq, gross: acc.gross + curr.grossCbuq, waste: acc.waste + curr.waste,
            hours: acc.hours + curr.workedHours, cap: acc.cap + curr.capConsumed,
            brita1: acc.brita1 + curr.brita1Consumed, brita0: acc.brita0 + curr.brita0Consumed, dust: acc.dust + curr.stoneDustConsumed
        }), { net: 0, gross: 0, waste: 0, hours: 0, cap: 0, brita1: 0, brita0: 0, dust: 0 });
        return { rangeProduction, bituSummary, prodTotals };
    }, [productionLogs, bituDeliveries, reportStartDate, reportEndDate]);
    const aggregateReportData = useMemo(() => {
        const allTimeByProduct = {};
        const rangeByProduct = {};
        deliveries.forEach((delivery) => {
            const product = String(delivery.product || 'Sem produto');
            const tons = Number(delivery.tons || 0);
            allTimeByProduct[product] = (allTimeByProduct[product] || 0) + tons;
            if (delivery.date >= reportStartDate && delivery.date <= reportEndDate) {
                rangeByProduct[product] = (rangeByProduct[product] || 0) + tons;
            }
        });
        const products = Array.from(new Set([...Object.keys(allTimeByProduct), ...Object.keys(rangeByProduct)])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const rows = products.map((product) => ({
            product,
            allTime: allTimeByProduct[product] || 0,
            inRange: rangeByProduct[product] || 0
        }));
        const totalAllTime = rows.reduce((acc, row) => acc + row.allTime, 0);
        const totalInRange = rows.reduce((acc, row) => acc + row.inRange, 0);
        return { rows, totalAllTime, totalInRange };
    }, [deliveries, reportEndDate, reportStartDate]);
    // --- HANDLERS ---
    const handleAddDelivery = (e) => {
        e.preventDefault();
        if (!newTons || !newTicket || !newProduct)
            return;
        setDeliveries(prev => [{ id: Date.now().toString(), date: newAggregateDate || todayStr, product: newProduct, tons: parseLocaleDecimal(newTons), ticketNumber: newTicket }, ...prev]);
        setNewTons('');
        setNewTicket('');
        if (isCustomProduct)
            setNewProduct('');
    };
    const handleDeleteDelivery = (id) => { if (window.confirm('Excluir registro?'))
        setDeliveries(prev => prev.filter(d => d.id !== id)); };
    const handleAddBituminous = (e) => {
        e.preventDefault();
        if (!newBituTons || !newBituTicket || !newBituSupplier)
            return;
        const tons = parseLocaleDecimal(newBituTons);
        if (tons === 0)
            return;
        setBituDeliveries(prev => [{
                id: `bitu-${Date.now()}`,
                date: newBituDate || todayStr,
                product: newBituProduct,
                tons,
                ticketNumber: newBituTicket,
                plate: newBituPlate || '',
                supplier: newBituSupplier
            }, ...prev]);
        setNewBituTons('');
        setNewBituTicket('');
        setNewBituPlate('');
        setNewBituSupplier('');
    };
    const handleDeleteBituminous = (id) => { if (window.confirm('Excluir registro?'))
        setBituDeliveries(prev => prev.filter(d => d.id !== id)); };
    const handleAddLoad = (e) => {
        e.preventDefault();
        if (!loadPlate || !loadTons || !loadTemp || !prodDate)
            return;
        setLoadEntries(prev => [...prev, { id: `load-${Date.now()}`, date: prodDate, plate: loadPlate, tons: parseLocaleDecimal(loadTons), temperature: parseLocaleDecimal(loadTemp) }]);
        setLoadPlate('');
        setLoadTons('');
        setLoadTemp('');
    };
    const handleDeleteLoad = (id) => { if (window.confirm('Remover carga?'))
        setLoadEntries(prev => prev.filter(l => l.id !== id)); };
    const handleAddProduction = (e) => {
        e.preventDefault();
        if (!prodDate)
            return;
        const gross = parseLocaleDecimal(prodGross);
        const waste = parseLocaleDecimal(prodWaste);
        const initial = parseLocaleDecimal(prodInitialHM);
        const final = parseLocaleDecimal(prodFinalHM);
        setProductionLogs(prev => [{ id: `prod-${Date.now()}`, date: prodDate, grossCbuq: gross, waste: waste, netCbuq: Math.max(0, gross - waste), capConsumed: parseLocaleDecimal(prodCap), brita1Consumed: parseLocaleDecimal(prodBrita1), brita0Consumed: parseLocaleDecimal(prodBrita0), stoneDustConsumed: parseLocaleDecimal(prodDust), initialHourMeter: initial, finalHourMeter: final, workedHours: Math.max(0, final - initial) }, ...prev]);
        setProdGross('');
        setProdWaste('');
        setProdCap('');
        setProdBrita1('');
        setProdBrita0('');
        setProdDust('');
        setProdInitialHM(prodFinalHM);
        setProdFinalHM('');
    };
    const handleDeleteProduction = (id) => { if (window.confirm('Excluir registro?'))
        setProductionLogs(prev => prev.filter(p => p.id !== id)); };
    const downloadUnifiedPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const { rangeProduction, bituSummary, prodTotals } = unifiedReportData;
        doc.setFontSize(18);
        doc.text("Relatório Geral de Usina - Produção & Insumos", 14, 20);
        doc.setFontSize(10);
        doc.text(`Intervalo: ${new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(reportEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 28);
        doc.setFontSize(12);
        doc.text("Resumo de Insumos Betuminosos (Ligantes)", 14, 40);
        autoTable(doc, {
            startY: 42,
            head: [['Produto', 'Entrada (t)', 'Consumo (t)', 'Saldo Período (t)']],
            body: Object.keys(bituSummary).map(key => [key, bituSummary[key].in.toFixed(2), bituSummary[key].out.toFixed(2), (bituSummary[key].in - bituSummary[key].out).toFixed(2)]),
            styles: { fontSize: 8 }
        });
        doc.setFontSize(12);
        doc.text("Resumo de Produção Diária (CBUQ)", 14, doc.lastAutoTable.finalY + 10);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 12,
            head: [['Data', 'Prod. Líq (t)', 'Rejeito (t)', 'CAP (t)', 'Brita 1 (t)', 'Brita 0 (t)', 'Pó Pedra (t)', 'Horas']],
            body: rangeProduction.map(log => [new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR'), log.netCbuq.toFixed(2), log.waste.toFixed(2), log.capConsumed.toFixed(2), log.brita1Consumed.toFixed(2), log.brita0Consumed.toFixed(2), log.stoneDustConsumed.toFixed(2), log.workedHours.toFixed(1)]),
            styles: { fontSize: 8 }
        });
        doc.setFontSize(12);
        doc.text("Totais do Período", 14, doc.lastAutoTable.finalY + 10);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 12,
            head: [['Total CBUQ (t)', 'Total Rejeito (t)', 'Total CAP (t)', 'Total Horas']],
            body: [[prodTotals.net.toFixed(2), prodTotals.waste.toFixed(2), prodTotals.cap.toFixed(2), prodTotals.hours.toFixed(1)]],
            theme: 'grid',
            styles: { fontSize: 9, fontStyle: 'bold' }
        });
        doc.save(`relatorio_usina_${reportStartDate}_a_${reportEndDate}.pdf`);
    };
    const downloadAggregatesPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const { rows, totalAllTime, totalInRange } = aggregateReportData;
        doc.setFontSize(18);
        doc.text("Relatório de Agregados - Usina", 14, 20);
        doc.setFontSize(10);
        doc.text(`Período selecionado: ${new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(reportEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 28);
        doc.text(`Total geral desde o início da obra: ${totalAllTime.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`, 14, 34);
        autoTable(doc, {
            startY: 40,
            head: [['Produto', 'Total no Período (t)', 'Total Geral na Obra (t)']],
            body: rows.map((row) => [
                row.product,
                row.inRange.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                row.allTime.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 8,
            head: [['Resumo', 'Valor']],
            body: [
                ['Total no período', `${totalInRange.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`],
                ['Total geral acumulado da obra', `${totalAllTime.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`]
            ],
            styles: { fontSize: 10, fontStyle: 'bold' },
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
            columnStyles: { 1: { halign: 'right' } }
        });
        doc.save(`relatorio_agregados_${reportStartDate}_a_${reportEndDate}.pdf`);
    };
    const trucks = useMemo(() => machines.filter(m => m.name.toLowerCase().includes('caminhão') && !m.name.toLowerCase().includes('pipa')), [machines]);
    const currentNetProduction = Math.max(0, parseLocaleDecimal(prodGross) - parseLocaleDecimal(prodWaste));
    const currentHours = Math.max(0, parseLocaleDecimal(prodFinalHM) - parseLocaleDecimal(prodInitialHM));
    const sortedAggregateDeliveries = useMemo(() => {
        const list = [...(deliveries || [])];
        const { key, direction } = aggregateSortConfig;
        const factor = direction === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            if (key === 'product') {
                return String(a.product || '').localeCompare(String(b.product || ''), 'pt-BR') * factor;
            }
            if (key === 'ticketNumber') {
                return String(a.ticketNumber || '').localeCompare(String(b.ticketNumber || ''), 'pt-BR') * factor;
            }
            if (key === 'tons') {
                return (Number(a.tons || 0) - Number(b.tons || 0)) * factor;
            }
            return String(a.date || '').localeCompare(String(b.date || '')) * factor;
        });
        return list;
    }, [deliveries, aggregateSortConfig]);
    const setAggregateSort = (key, direction) => {
        setAggregateSortConfig({ key, direction });
    };
    return (<div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h3 className="text-2xl font-bold text-brand-light flex items-center gap-2">
                    <FactoryIcon className="w-8 h-8 text-brand-accent"/>
                    Usina de Asfalto
                </h3>
            </div>
            <div className="bg-brand-secondary p-4 rounded-xl border border-slate-700 shadow-xl flex flex-col sm:flex-row items-end gap-3 shrink-0">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-brand-accent uppercase mb-1 tracking-widest ml-1">Gerar Relatório Unificado</span>
                    <div className="flex gap-2">
                        <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:ring-1 focus:ring-brand-accent outline-none"/>
                        <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:ring-1 focus:ring-brand-accent outline-none"/>
                    </div>
                </div>
                <button onClick={() => setIsReportModalOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-black text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 h-[34px] uppercase tracking-tighter">
                    <PrinterIcon className="w-4 h-4"/>
                    Pré-Visualizar
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <SmallMetricCard title="Produção Total CBUQ" value={`${productionLogs.reduce((a, b) => a + b.netCbuq, 0).toFixed(2)} t`} icon={<FactoryIcon className="w-8 h-8"/>} color="text-orange-400"/>
            <SmallMetricCard title="Temperatura Mistura" value={`${loadEntries.length === 0 ? 0 : (loadEntries.reduce((a, b) => a + b.temperature, 0) / loadEntries.length).toFixed(1)} °C`} icon={<ChartIcon className="w-8 h-8"/>} color="text-red-400"/>
            
            <MetricCard title="Estoque CAP" value={`${(bituStats['CAP']?.balance || 0).toFixed(1)} t`} icon={<CubeIcon className="w-8 h-8"/>} color="text-blue-400"/>
            <div className="flex flex-col gap-3">
                <MetricCard title={`Estoque: ${viewedAggregate}`} value={`${selectedAggregateValue.toFixed(1)} t`} icon={<CubeIcon className="w-8 h-8"/>} color="text-green-400"/>
                <div className="flex items-center justify-between bg-brand-secondary p-2 rounded-lg border border-slate-700 shadow-lg">
                    <select value={viewedAggregate} onChange={(e) => setViewedAggregate(e.target.value)} className="w-full bg-brand-primary border border-slate-600 text-brand-light text-[10px] font-bold rounded px-2 py-1 focus:outline-none cursor-pointer">
                        <option value="Total Geral">Total Geral</option>
                        {Object.keys(totals).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-slate-700">
            <div className="flex justify-between items-center mb-8">
                <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><CubeIcon className="w-6 h-6 text-brand-accent"/> Estoque Ligantes</h4>
                <button onClick={() => setShowCapacitySettings(!showCapacitySettings)} className={`p-1.5 rounded-full transition-colors ${showCapacitySettings ? 'bg-brand-accent text-brand-primary' : 'bg-brand-primary text-brand-muted hover:text-brand-light'}`}><CogIcon className="w-4 h-4"/></button>
            </div>
            {showCapacitySettings && (<div className="mb-8 p-4 bg-brand-primary rounded-lg border border-brand-accent/30 animate-in fade-in slide-in-from-top-2">
                    <h5 className="text-xs font-bold text-brand-accent uppercase mb-3">Configuração de Capacidade Máxima (Ton)</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.keys(tankCapacities).map(key => (<div key={`cap-${key}`}><label className="block text-[10px] text-brand-muted uppercase mb-1 font-bold">{key}</label>
                            <input type="number" value={tankCapacities[key]} onChange={(e) => setTankCapacities(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs outline-none"/></div>))}
                    </div>
                </div>)}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                {Object.entries(bituStats).map(([key, data]) => (<BituVisualTank3D key={key} label={key} current={data.balance} capacity={tankCapacities[key] || 1}/>))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-brand-primary p-6 rounded-lg border border-slate-700 h-fit">
                    <h5 className="text-brand-light font-bold mb-4 flex items-center gap-2"><PlusIcon className="w-5 h-5 text-green-400"/> Registrar Entrada Ligante</h5>
                    <form onSubmit={handleAddBituminous} className="space-y-4">
                        <div><label className="block text-sm font-medium text-brand-muted mb-1 uppercase">Produto</label><select value={newBituProduct} onChange={(e) => setNewBituProduct(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 focus:ring-1 focus:ring-brand-accent focus:outline-none"><option value="CAP">CAP</option><option value="EAI">EAI</option><option value="RR-2C">RR-2C</option><option value="RR-1C">RR-1C</option></select></div>
                        <div>
                            <label className="block text-sm font-medium text-brand-muted mb-1 uppercase">Data</label>
                            <input type="date" value={newBituDate} onChange={(e) => setNewBituDate(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-brand-muted mb-1 uppercase">Peso (Ton)</label>
                                <input type="text" inputMode="decimal" value={newBituTons} onChange={(e) => setNewBituTons(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Ex: 33,55 ou -10 para baixa" required/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-muted mb-1 uppercase">NF</label>
                                <input type="text" value={newBituTicket} onChange={(e) => setNewBituTicket(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" required/>
                            </div>
                        </div>
                        
                        {/* Campos Adicionados: Placa e Fornecedor */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-brand-muted mb-1 uppercase">Placa Veículo</label>
                                <input type="text" value={newBituPlate} onChange={(e) => setNewBituPlate(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="ABC-1234"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-muted mb-1 uppercase">Fornecedor</label>
                                <input type="text" value={newBituSupplier} onChange={(e) => setNewBituSupplier(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" required/>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-brand-accent text-brand-primary font-bold py-2 rounded hover:brightness-110 flex items-center justify-center gap-2 mt-2">Registrar</button>
                    </form>
                </div>
                <div className="lg:col-span-2">
                    <h5 className="text-brand-light font-bold mb-4 flex items-center gap-2"><TruckIcon className="w-5 h-5 text-blue-400"/> Histórico Entradas (Ligantes)</h5>
                    <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                        <table className="min-w-full text-sm text-left text-brand-muted">
                            <thead className="bg-slate-800 text-xs uppercase sticky top-0"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">NF</th><th className="px-4 py-3 text-right">Peso (t)</th><th className="px-4 py-3 text-center">Ação</th></tr></thead>
                            <tbody>
                                {bituDeliveries.map((delivery) => (<tr key={delivery.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"><td className="px-4 py-3 whitespace-nowrap">{new Date(delivery.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td className="px-4 py-3 text-brand-light">{delivery.product}</td><td className="px-4 py-3">{delivery.ticketNumber}</td><td className={`px-4 py-3 text-right font-bold ${Number(delivery.tons || 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>{delivery.tons.toFixed(2)}</td><td className="px-4 py-3 text-center"><button onClick={() => handleDeleteBituminous(delivery.id)} className="text-red-500 hover:text-red-400 p-1"><TrashIcon className="w-4 h-4"/></button></td></tr>))}
                                {bituDeliveries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center italic">Sem dados.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-orange-500">
            <h4 className="text-lg font-semibold text-brand-light mb-6 flex items-center gap-2"><ClipboardListIcon className="w-6 h-6 text-orange-400"/> Controle Diário de Produção</h4>
            <form onSubmit={handleAddProduction} className="mb-8">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-brand-muted mb-1 uppercase">Data da Produção</label>
                    <input type="date" value={prodDate} onChange={e => setProdDate(e.target.value)} className="w-full sm:w-64 bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none" required/>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-brand-primary p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                        <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-3 flex items-center gap-2"><TruckIcon className="w-4 h-4 text-orange-400"/> Viagens</h5>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <select value={loadPlate} onChange={e => setLoadPlate(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs outline-none"><option value="">Prefixo...</option>{trucks.map(truck => (<option key={truck.id} value={truck.prefix}>{truck.prefix}</option>))}</select>
                            <input type="text" inputMode="decimal" value={loadTons} onChange={e => setLoadTons(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs outline-none" placeholder="Peso"/>
                            <input type="text" inputMode="decimal" value={loadTemp} onChange={e => setLoadTemp(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs" placeholder="Temp"/>
                        </div>
                        <button type="button" onClick={handleAddLoad} className="w-full bg-orange-600/80 text-white text-xs font-bold py-2 rounded mb-3">Adicionar Carga</button>
                        <div className="flex-1 overflow-y-auto max-h-[320px] border border-slate-700 rounded bg-brand-secondary">
                             <table className="w-full text-xs text-brand-muted">
                                <thead className="bg-slate-700 text-brand-light sticky top-0">
                                    <tr>
                                        {/* CHANGED: 'Placa' to 'Prefixo', adjusted alignment classes */}
                                        <th className="p-2 text-left">Prefixo</th>
                                        <th className="p-2 text-center">Ton</th>
                                        <th className="p-2 text-center">°C</th>
                                        <th className="p-2 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {loadEntries.filter(l => l.date === prodDate).map(load => (<tr key={load.id}>
                                            <td className="p-2 text-left">{load.plate}</td>
                                            <td className="p-2 text-center">{load.tons}</td>
                                            <td className="p-2 text-center">{load.temperature}°</td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleDeleteLoad(load.id)} className="text-red-400 hover:text-red-300">
                                                    <TrashIcon className="w-3 h-3"/>
                                                </button>
                                            </td>
                                        </tr>))}
                                </tbody>
                             </table>
                        </div>
                    </div>
                    <div className="lg:col-span-3 bg-brand-primary p-4 rounded-lg border border-slate-700 space-y-3">
                        <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-2">Produção</h5>
                        <input type="text" inputMode="decimal" value={prodGross} onChange={e => setProdGross(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Bruta (t)" required/>
                        <input type="text" inputMode="decimal" value={prodWaste} onChange={e => setProdWaste(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Rejeito (t)"/>
                        <div className="bg-slate-700/50 p-3 rounded text-center border border-slate-600 mt-4"><span className="block text-xs text-brand-muted uppercase">Líquida</span><span className="text-2xl font-bold text-green-400">{currentNetProduction.toFixed(2)} t</span></div>
                    </div>
                    <div className="lg:col-span-3 bg-brand-primary p-4 rounded-lg border border-slate-700 space-y-3">
                        <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-2">Consumo</h5>
                        <input type="text" inputMode="decimal" value={prodCap} onChange={e => setProdCap(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="CAP (t)"/>
                        <input type="text" inputMode="decimal" value={prodBrita1} onChange={e => setProdBrita1(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Brita 1 (t)"/>
                        <input type="text" inputMode="decimal" value={prodBrita0} onChange={e => setProdBrita0(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Brita 0 (t)"/>
                        <input type="text" inputMode="decimal" value={prodDust} onChange={e => setProdDust(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Pó de Pedra (t)"/>
                    </div>
                    <div className="lg:col-span-2 bg-brand-primary p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
                         <div className="space-y-3">
                            <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-2">Horas</h5>
                            <input type="text" inputMode="decimal" value={prodInitialHM} onChange={e => setProdInitialHM(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Inicial" required/>
                            <input type="text" inputMode="decimal" value={prodFinalHM} onChange={e => setProdFinalHM(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Final" required/>
                            <div className="text-center text-xs text-brand-muted mt-2 border-t border-slate-600 pt-2">Horas Trab.<br /><span className="text-brand-light font-bold text-lg">{currentHours.toFixed(1)} h</span></div>
                         </div>
                         <button type="submit" className="w-full mt-4 bg-orange-500 text-brand-primary font-bold py-3 rounded shadow-lg">Salvar Produção</button>
                    </div>
                </div>
            </form>
            <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                <table className="min-w-full table-fixed text-sm text-brand-muted">
                    <colgroup>
                        <col className="w-[22%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[14%]" />
                    </colgroup>
                    <thead className="bg-slate-800 text-xs uppercase sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left">Data</th>
                            <th className="px-4 py-3 text-right">Prod. Líq</th>
                            <th className="px-4 py-3 text-right">Rejeito</th>
                            <th className="px-4 py-3 text-right">CAP</th>
                            <th className="px-4 py-3 text-right">Horas</th>
                            <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productionLogs.map(log => (
                            <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-brand-light">
                                    {new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-4 py-3 text-right text-green-400 font-bold tabular-nums">
                                    {log.netCbuq.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right text-red-400 tabular-nums">
                                    {log.waste.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {log.capConsumed.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {log.workedHours.toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => handleDeleteProduction(log.id)} className="text-red-500 hover:text-red-400" title="Excluir registro">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {productionLogs.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center italic text-brand-muted">
                                    Nenhum lançamento de produção.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-green-500">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><CubeIcon className="w-6 h-6 text-brand-accent"/> Estoque de Agregados</h4>
                <button
                    onClick={() => setIsAggregatesReportModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase tracking-wider"
                    title="Pré-visualizar relatório de agregados"
                >
                    <PrinterIcon className="w-4 h-4" />
                    PDF Agregados
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">{Object.entries(totals).map(([key, value]) => (<div key={key} className="bg-brand-primary p-4 rounded-lg border border-slate-700"><label className="block text-xs font-bold text-brand-muted uppercase mb-2">{key}</label><div className="text-2xl font-bold text-brand-light">{value.toFixed(1)} <span className="text-sm font-normal text-brand-muted">t</span></div></div>))}</div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-brand-primary p-6 rounded-lg border border-slate-700 h-fit">
                    <h5 className="text-brand-light font-bold mb-4">Registrar Entrada Agregado</h5>
                    <form onSubmit={handleAddDelivery} className="space-y-4">
                        <div className="flex gap-2 items-center">
                            {isCustomProduct ? (<input type="text" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none animate-in fade-in" placeholder="Nome do Material" autoFocus/>) : (<select value={newProduct} onChange={(e) => setNewProduct(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none">
                                    <option value="Brita 1">Brita 1</option>
                                    <option value="Brita 0">Brita 0</option>
                                    <option value="Pó de Pedra">Pó de Pedra</option>
                                    <option value="Pedra Pulmão">Pedra Pulmão</option>
                                </select>)}
                            <button type="button" onClick={() => {
            setIsCustomProduct(!isCustomProduct);
            setNewProduct(isCustomProduct ? 'Brita 1' : ''); // Reset to default or clear when switching
        }} className={`p-2 rounded transition-colors border ${isCustomProduct ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/40' : 'bg-brand-accent/20 border-brand-accent/50 text-brand-accent hover:bg-brand-accent/40'}`} title={isCustomProduct ? "Cancelar" : "Adicionar Outro Material"}>
                                {isCustomProduct ? <XMarkIcon className="w-5 h-5"/> : <PlusIcon className="w-5 h-5"/>}
                            </button>
                        </div>
                        <input type="date" value={newAggregateDate} onChange={(e) => setNewAggregateDate(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none"/>
                        <input type="text" inputMode="decimal" value={newTons} onChange={(e) => setNewTons(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Peso (t) - ex: 33,55" required/>
                        <input type="text" value={newTicket} onChange={(e) => setNewTicket(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Ticket/NF" required/>
                        <button type="submit" className="w-full bg-brand-accent text-brand-primary font-bold py-2 rounded">Registrar</button>
                    </form>
                </div>
                <div className="lg:col-span-2">
                    <h5 className="text-brand-light font-bold mb-4">Histórico Entradas (Agregados)</h5>
                    <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                        <table className="min-w-full text-sm text-brand-muted">
                            <thead className="bg-slate-800 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">
                                        <div className="inline-flex items-center gap-1">
                                            Produto
                                            <button type="button" onClick={() => setAggregateSort('product', 'asc')} className={`p-0.5 rounded border transition-colors ${aggregateSortConfig.key === 'product' && aggregateSortConfig.direction === 'asc' ? 'bg-amber-300 text-brand-primary border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/35'}`} title="Ordenar produto (A-Z)">
                                                <ArrowUpIcon className="w-3 h-3" />
                                            </button>
                                            <button type="button" onClick={() => setAggregateSort('product', 'desc')} className={`p-0.5 rounded border transition-colors ${aggregateSortConfig.key === 'product' && aggregateSortConfig.direction === 'desc' ? 'bg-amber-300 text-brand-primary border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/35'}`} title="Ordenar produto (Z-A)">
                                                <ArrowDownIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </th>
                                    <th className="px-4 py-3">
                                        <div className="inline-flex items-center gap-1">
                                            Ticket/NF
                                            <button type="button" onClick={() => setAggregateSort('ticketNumber', 'asc')} className={`p-0.5 rounded border transition-colors ${aggregateSortConfig.key === 'ticketNumber' && aggregateSortConfig.direction === 'asc' ? 'bg-amber-300 text-brand-primary border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/35'}`} title="Ordenar ticket/NF (menor para maior)">
                                                <ArrowUpIcon className="w-3 h-3" />
                                            </button>
                                            <button type="button" onClick={() => setAggregateSort('ticketNumber', 'desc')} className={`p-0.5 rounded border transition-colors ${aggregateSortConfig.key === 'ticketNumber' && aggregateSortConfig.direction === 'desc' ? 'bg-amber-300 text-brand-primary border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/35'}`} title="Ordenar ticket/NF (maior para menor)">
                                                <ArrowDownIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right">Peso</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAggregateDeliveries.map((delivery) => (
                                    <tr key={delivery.id} className="border-b border-slate-700">
                                        <td className="px-4 py-3">{new Date(delivery.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="px-4 py-3">{delivery.product}</td>
                                        <td className="px-4 py-3">{delivery.ticketNumber || '-'}</td>
                                        <td className="px-4 py-3 text-right font-bold text-green-400">{delivery.tons.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleDeleteDelivery(delivery.id)} className="text-red-500">
                                                <TrashIcon className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* --- AGGREGATES REPORT PREVIEW MODAL --- */}
        {isAggregatesReportModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                <PrinterIcon className="w-6 h-6 text-purple-600"/>
                                Relatório de Agregados
                            </h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Pré-visualização</p>
                        </div>
                        <button onClick={() => setIsAggregatesReportModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-2 rounded-full hover:bg-white transition-all"><XMarkIcon className="w-7 h-7"/></button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[10px] uppercase font-black text-slate-500 mb-1">Período</span>
                                <p className="text-sm font-bold">{new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(reportEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[10px] uppercase font-black text-slate-500 mb-1">Total no período</span>
                                <p className="text-xl font-black text-blue-600">{aggregateReportData.totalInRange.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[10px] uppercase font-black text-slate-500 mb-1">Total geral acumulado</span>
                                <p className="text-xl font-black text-green-600">{aggregateReportData.totalAllTime.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="min-w-full text-sm text-left text-slate-700">
                                <thead className="bg-slate-800 text-white text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Produto</th>
                                        <th className="px-4 py-3 text-right">Total no período (t)</th>
                                        <th className="px-4 py-3 text-right">Total geral na obra (t)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {aggregateReportData.rows.map((row) => (<tr key={row.product} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-semibold">{row.product}</td>
                                            <td className="px-4 py-3 text-right">{row.inRange.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-3 text-right font-bold">{row.allTime.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>))}
                                    {aggregateReportData.rows.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center italic text-slate-400">Sem dados para o período.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                        <button onClick={() => setIsAggregatesReportModalOpen(false)} className="px-5 py-2 bg-white border border-slate-300 text-slate-700 font-black rounded-lg hover:bg-slate-50 transition-all uppercase text-xs">Cancelar</button>
                        <button onClick={downloadAggregatesPDF} className="px-5 py-2 bg-purple-600 text-white font-black rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 uppercase text-xs">
                            <PrinterIcon className="w-4 h-4"/> Gerar PDF Oficial
                        </button>
                    </div>
                </div>
            </div>)}

        {/* --- CONSOLIDATED REPORT MODAL --- */}
        {isReportModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-100 px-8 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                <PrinterIcon className="w-7 h-7 text-purple-600"/>
                                Relatório Geral de Usina
                            </h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Controle Unificado - Produção e Insumos</p>
                        </div>
                        <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-2 rounded-full hover:bg-white transition-all"><XMarkIcon className="w-8 h-8"/></button>
                    </div>
                    
                    <div className="p-10 overflow-y-auto flex-1 bg-white text-slate-800 scroll-smooth">
                        {/* PAPEL TIMBRADO HEADER */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b-4 border-brand-logo pb-6">
                            <div className="bg-brand-logo p-4 rounded-xl text-white flex flex-col items-center justify-center shadow-lg mb-4 md:mb-0">
                                <span className="text-[8px] font-bold tracking-[0.2em] uppercase leading-none mb-0.5">Construtora</span>
                                <span className="text-3xl font-black italic tracking-tighter leading-none">PERFIL</span>
                            </div>
                            <div className="text-right">
                                <h3 className="text-2xl font-black text-slate-900 leading-none mb-1 uppercase">Relatório Técnico de Usina</h3>
                                <p className="text-lg font-bold text-slate-600">Produção de CBUQ & Controle de Ligantes</p>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Intervalo: {new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(reportEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>

                        {/* SUMMARY DATA */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Total CBUQ Produzido</span>
                                <p className="text-2xl font-black text-slate-800">{unifiedReportData.prodTotals.net.toFixed(2)} <span className="text-xs">t</span></p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Total CAP Consumido</span>
                                <p className="text-2xl font-black text-blue-600">{unifiedReportData.prodTotals.cap.toFixed(2)} <span className="text-xs">t</span></p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Total Horas Trabalhadas</span>
                                <p className="text-2xl font-black text-purple-600">{unifiedReportData.prodTotals.hours.toFixed(1)} <span className="text-xs">h</span></p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Média Prod. Diária</span>
                                <p className="text-2xl font-black text-green-600">{(unifiedReportData.prodTotals.net / (unifiedReportData.rangeProduction.length || 1)).toFixed(2)} <span className="text-xs">t/dia</span></p>
                            </div>
                        </div>

                        {/* SECTION: LIGANTES */}
                        <h4 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
                             <CubeIcon className="w-5 h-5 text-slate-600"/>
                             Consolidação de Insumos Betuminosos
                        </h4>
                        <table className="w-full text-xs border-collapse border border-slate-200 mb-10">
                            <thead className="bg-slate-800 text-white font-black uppercase">
                                <tr>
                                    <th className="p-3 text-left">Produto</th>
                                    <th className="p-3 text-right">Entradas no Período (t)</th>
                                    <th className="p-3 text-right">Consumo no Período (t)</th>
                                    <th className="p-3 text-right">Saldo do Intervalo (t)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(unifiedReportData.bituSummary).map(([key, data]) => {
                // CAST: Fix unknown type error by explicitly casting entry value to expected structure
                const val = data;
                return (<tr key={key} className="border-b border-slate-200 hover:bg-slate-50">
                                            <td className="p-3 font-bold">{key}</td>
                                            <td className="p-3 text-right text-green-600">+{val.in.toFixed(2)}</td>
                                            <td className="p-3 text-right text-red-600">-{val.out.toFixed(2)}</td>
                                            <td className="p-3 text-right font-black">{(val.in - val.out).toFixed(2)}</td>
                                        </tr>);
            })}
                            </tbody>
                        </table>

                        {/* SECTION: PRODUCTION LOGS */}
                        <h4 className="text-sm font-black text-slate-900 uppercase border-b-2 border-slate-900 pb-2 mb-4 flex items-center gap-2">
                             <FactoryIcon className="w-5 h-5 text-slate-600"/>
                             Detalhamento Diário de Produção (CBUQ)
                        </h4>
                        <table className="w-full text-xs border-collapse border border-slate-200">
                            <thead className="bg-slate-800 text-white font-black uppercase">
                                <tr>
                                    <th className="p-2 text-left">Data</th>
                                    <th className="p-2 text-right">Prod. Líq (t)</th>
                                    <th className="p-2 text-right">CAP (t)</th>
                                    <th className="p-2 text-right">Brita 1 (t)</th>
                                    <th className="p-2 text-right">Brita 0 (t)</th>
                                    <th className="p-2 text-right">Pó (t)</th>
                                    <th className="p-2 text-center">Horas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {unifiedReportData.rangeProduction.map(log => (<tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-2 font-medium">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="p-2 text-right font-black text-slate-900">{log.netCbuq.toFixed(2)}</td>
                                        <td className="p-2 text-right text-blue-600 font-bold">{log.capConsumed.toFixed(2)}</td>
                                        <td className="p-2 text-right">{log.brita1Consumed.toFixed(2)}</td>
                                        <td className="p-2 text-right">{log.brita0Consumed.toFixed(2)}</td>
                                        <td className="p-2 text-right">{log.stoneDustConsumed.toFixed(2)}</td>
                                        <td className="p-2 text-center font-bold">{log.workedHours.toFixed(1)}</td>
                                    </tr>))}
                                {unifiedReportData.rangeProduction.length === 0 && <tr><td colSpan={7} className="p-10 text-center italic text-slate-400">Nenhuma produção registrada no intervalo.</td></tr>}
                            </tbody>
                        </table>
                        
                        {/* SIGNATURES */}
                        <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-20">
                            <div className="text-center border-t border-slate-300 pt-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Encarregado de Usina</p>
                                <p className="text-sm font-bold text-slate-600 italic">Assinatura Digital - PERFIL</p>
                            </div>
                            <div className="text-center border-t border-slate-300 pt-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Engenheiro Responsável</p>
                                <p className="text-sm font-bold text-slate-600 italic">Assinatura Digital - PERFIL</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-100 px-10 py-6 border-t border-slate-200 flex justify-end gap-6 shrink-0 shadow-inner">
                        <button onClick={() => setIsReportModalOpen(false)} className="px-8 py-3 bg-white border border-slate-300 text-slate-700 font-black rounded-xl shadow-sm hover:bg-slate-50 transition-all uppercase tracking-widest text-xs">Cancelar</button>
                        <button onClick={downloadUnifiedPDF} className="px-8 py-3 bg-purple-600 text-white font-black rounded-xl shadow-xl hover:bg-purple-700 transition-all flex items-center gap-3 uppercase tracking-widest text-xs">
                            <PrinterIcon className="w-5 h-5"/> 
                            Gerar PDF Oficial
                        </button>
                    </div>
                </div>
            </div>)}
    </div>);
};
export default UsinaView;

