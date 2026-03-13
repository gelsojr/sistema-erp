import React, { useState, useMemo, useEffect } from 'react';
import { MachineStatus } from '../types';
import MetricCard from './MetricCard';
import OficinaSummary from './MaintenanceSchedule';
import WorkshopActivityTimeline from './WorkshopActivityTimeline';
import MachineList from './MachineList';
import { WrenchIcon, GraderIcon, ChartIcon, CalendarIcon, BridgeIcon, CubeIcon, UserGroupIcon, HistoryIcon, ShoppingCartIcon, FactoryIcon, FuelIcon, DropIcon, TruckIcon, ArrowUpIcon, ArrowDownIcon, ClockIcon, PrinterIcon, XMarkIcon, ClipboardListIcon, PlusIcon, ThermometerIcon } from './icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
// --- WORKING HOURS LOGIC (9h/day: 07-11 & 13-18) ---
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
const calculateHoursStopped = (statusChangeDate, lastStatusChangeTime) => {
    return Math.floor(calculateWorkingHours(statusChangeDate, lastStatusChangeTime));
};
const calculateDurationString = (statusChangeDate, lastStatusChangeTime) => {
    const totalMinutes = Math.max(0, Math.floor(calculateWorkingHours(statusChangeDate, lastStatusChangeTime) * 60));
    const minutesPerWorkday = 9 * 60;
    const days = Math.floor(totalMinutes / minutesPerWorkday);
    const remainingMinutes = totalMinutes - (days * minutesPerWorkday);
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    if (days > 0)
        return `${days}d ${hours}h`;
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};
const calculateDaysStopped = (statusChangeDate, lastStatusChangeTime) => {
    const totalHours = calculateWorkingHours(statusChangeDate, lastStatusChangeTime || '00:00');
    return Math.floor(totalHours / 9);
};
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const parseFlexibleDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw)
        return null;
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let parsed;
    if (brMatch) {
        parsed = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T00:00:00`);
    }
    else if (isoMatch) {
        parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    }
    else {
        parsed = new Date(raw);
    }
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed;
};
const parseFuelVolume = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    const raw = String(value || '').trim();
    if (!raw)
        return 0;
    const hasComma = raw.includes(',');
    const hasDot = raw.includes('.');
    let normalized = raw;
    if (hasComma && hasDot) {
        const lastComma = raw.lastIndexOf(',');
        const lastDot = raw.lastIndexOf('.');
        normalized = lastComma > lastDot
            ? raw.replace(/\./g, '').replace(',', '.')
            : raw.replace(/,/g, '');
    }
    else if (hasComma) {
        normalized = raw.replace(',', '.');
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};
const getDaysWorked = (startStr, terminationDate) => {
    const start = new Date(startStr + 'T00:00:00');
    const end = terminationDate ? new Date(terminationDate + 'T00:00:00') : new Date();
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
};
const getInclusiveDaysInRange = (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr)
        return 0;
    const normalize = (value) => {
        const raw = String(value || '').trim();
        const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        }
        return raw;
    };
    const start = new Date(normalize(startDateStr) + 'T00:00:00');
    const end = new Date(normalize(endDateStr) + 'T00:00:00');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start)
        return 0;
    const diff = end.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};
const calculateFoodChargeDays = (employee, rangeStartStr, rangeEndStr) => {
    const start = rangeStartStr || employee.startDate;
    const end = rangeEndStr || employee.terminationDate || new Date().toISOString().split('T')[0];
    const totalDays = getInclusiveDaysInRange(start, end);
    if (totalDays <= 0)
        return 0;
    if (!employee.deBaixadaSince) {
        return totalDays;
    }
    const startTs = new Date(start + 'T00:00:00').getTime();
    const endTs = new Date(end + 'T00:00:00').getTime();
    const baixadaTs = new Date(String(employee.deBaixadaSince).replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1') + 'T00:00:00').getTime();
    if (Number.isNaN(startTs) || Number.isNaN(endTs) || Number.isNaN(baixadaTs)) {
        return totalDays;
    }
    if (baixadaTs <= startTs) {
        return 0;
    }
    if (baixadaTs > endTs) {
        return totalDays;
    }
    const foodEndDate = new Date(baixadaTs);
    foodEndDate.setDate(foodEndDate.getDate() - 1);
    const safeEnd = foodEndDate.toISOString().split('T')[0];
    return getInclusiveDaysInRange(start, safeEnd);
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
const DashboardBridgeReportModal = ({ isOpen, onClose, project, materials, employees, dailyLogs }) => {
    const [startDate, setStartDate] = useState(project.startDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    if (!isOpen)
        return null;
    // Filter Logic
    const filteredMaterials = materials.filter(m => m.receiptDate >= startDate && m.receiptDate <= endDate);
    // Calculations within Range
    const totalMaterials = filteredMaterials.reduce((acc, m) => acc + m.totalValue, 0);
    const totalEquipment = dailyLogs
        .filter(l => l.date >= startDate && l.date <= endDate)
        .reduce((acc, l) => acc + l.equipmentList.reduce((sum, eq) => sum + eq.dailyCost, 0), 0);
    // Prepare Flat List for Equipment Table
    const equipmentDetails = dailyLogs
        .filter(l => l.date >= startDate && l.date <= endDate)
        .flatMap(log => log.equipmentList.map(eq => ({
        date: log.date,
        prefix: eq.prefix,
        cost: eq.dailyCost
    })));
    const laborDetails = employees.map(emp => {
        // Calculate overlap days
        const empStart = new Date(emp.startDate);
        const empEnd = emp.terminationDate ? new Date(emp.terminationDate) : new Date();
        const reportStart = new Date(startDate);
        const reportEnd = new Date(endDate);
        const effectiveStart = empStart > reportStart ? empStart : reportStart;
        const effectiveEnd = empEnd < reportEnd ? empEnd : reportEnd;
        let daysInRange = 0;
        if (effectiveStart <= effectiveEnd) {
            const diff = effectiveEnd.getTime() - effectiveStart.getTime();
            daysInRange = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
        }
        const dailySalary = emp.salary / 30;
        const dailyFood = (emp.breakfastCost || 0) + (emp.lunchCost || 0) + (emp.dinnerCost || 0);
        const foodDays = calculateFoodChargeDays(emp, startDate, endDate);
        const totalCost = (daysInRange * dailySalary) + (foodDays * dailyFood) + (emp.totalAdditionalCost || 0);
        return { ...emp, daysInRange, totalCost };
    }).filter(e => e.daysInRange > 0 || e.totalAdditionalCost > 0);
    const totalLabor = laborDetails.reduce((acc, emp) => acc + emp.totalCost, 0);
    const totalGeneral = totalMaterials + totalLabor + totalEquipment;
    const generatePDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Relatório de Custos - Obra de Arte Especial", 14, 20);
        doc.setFontSize(10);
        doc.text(`Projeto: ${project.name}`, 14, 28);
        doc.text(`Período: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 34);
        autoTable(doc, {
            startY: 40,
            head: [['Categoria', 'Custo Total (R$)']],
            body: [
                ['Materiais', formatCurrency(totalMaterials)],
                ['Mão de Obra', formatCurrency(totalLabor)],
                ['Equipamentos', formatCurrency(totalEquipment)],
                ['TOTAL GERAL', formatCurrency(totalGeneral)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });
        doc.text("Detalhamento de Materiais", 14, doc.lastAutoTable.finalY + 10);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 12,
            head: [['Data', 'Material', 'Forn.', 'Qtd', 'Total']],
            body: filteredMaterials.map(m => [
                new Date(m.receiptDate + 'T00:00:00').toLocaleDateString('pt-BR'),
                m.material,
                m.supplier,
                `${m.quantity} ${m.unit}`,
                formatCurrency(m.totalValue)
            ]),
            styles: { fontSize: 8 }
        });
        doc.text("Apontamento de Equipamentos", 14, doc.lastAutoTable.finalY + 10);
        const equipRows = [];
        equipmentDetails.forEach(item => {
            equipRows.push([
                new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR'),
                item.prefix,
                formatCurrency(item.cost)
            ]);
        });
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 12,
            head: [['Data', 'Equipamento', 'Custo Diária']],
            body: equipRows,
            styles: { fontSize: 8 }
        });
        doc.save(`custos_${project.name.replace(/\s+/g, '_')}.pdf`);
    };
    return (<div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-100 p-4 border-b flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <PrinterIcon className="w-6 h-6 text-brand-logo"/> Relatório Financeiro do Projeto
                        </h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest">{project.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><XMarkIcon className="w-6 h-6"/></button>
                </div>

                <div className="bg-white p-4 border-b flex flex-wrap gap-4 items-center shrink-0">
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Início</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded p-1 text-sm text-slate-700 font-bold"/>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Fim</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded p-1 text-sm text-slate-700 font-bold"/>
                    </div>
                    <div className="ml-auto flex gap-2">
                        <button onClick={generatePDF} className="bg-brand-logo hover:brightness-110 text-white px-4 py-2 rounded shadow-lg text-xs font-bold uppercase flex items-center gap-2">
                            <PrinterIcon className="w-4 h-4"/> Baixar PDF
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-slate-800">
                    <div className="bg-white shadow-sm border p-8 min-h-[800px] max-w-3xl mx-auto">
                        <div className="border-b-2 border-slate-800 pb-4 mb-8 flex justify-between items-end">
                            <div>
                                <h1 className="text-2xl font-black uppercase text-slate-900">Relatório de Custos</h1>
                                <p className="text-sm font-medium text-slate-500">{project.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Período</p>
                                <p className="text-sm font-bold text-slate-800">{new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <div className="bg-slate-100 p-3 rounded border">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Materiais</span>
                                <span className="text-lg font-bold text-green-600">{formatCurrency(totalMaterials)}</span>
                            </div>
                            <div className="bg-slate-100 p-3 rounded border">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Mão de Obra</span>
                                <span className="text-lg font-bold text-blue-600">{formatCurrency(totalLabor)}</span>
                            </div>
                            <div className="bg-slate-100 p-3 rounded border">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Equipamentos</span>
                                <span className="text-lg font-bold text-amber-600">{formatCurrency(totalEquipment)}</span>
                            </div>
                            <div className="bg-slate-800 p-3 rounded text-white">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Geral</span>
                                <span className="text-lg font-bold text-brand-accent">{formatCurrency(totalGeneral)}</span>
                            </div>
                        </div>

                        <h3 className="text-xs font-black uppercase border-b mb-3 pb-1">Detalhamento de Materiais</h3>
                        <table className="w-full text-xs text-left mb-8 border-collapse">
                            <thead className="bg-slate-100 font-bold"><tr><th className="p-2">Data</th><th className="p-2">Material</th><th className="p-2 text-right">Valor Total</th></tr></thead>
                            <tbody>
                                {filteredMaterials.map(m => (<tr key={m.id} className="border-b border-slate-100"><td className="p-2">{new Date(m.receiptDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td className="p-2">{m.material} <span className="text-slate-400">({m.quantity}{m.unit})</span></td><td className="p-2 text-right font-mono">{formatCurrency(m.totalValue)}</td></tr>))}
                                {filteredMaterials.length === 0 && <tr><td colSpan={3} className="p-4 text-center italic text-slate-400">Sem registros no período.</td></tr>}
                            </tbody>
                        </table>

                        <h3 className="text-xs font-black uppercase border-b mb-3 pb-1">Mão de Obra (Proporcional ao Período)</h3>
                        <table className="w-full text-xs text-left mb-8 border-collapse">
                            <thead className="bg-slate-100 font-bold"><tr><th className="p-2">Colaborador</th><th className="p-2 text-center">Dias no Período</th><th className="p-2 text-right">Custo Apróx.</th></tr></thead>
                            <tbody>
                                {laborDetails.map(emp => (<tr key={emp.id} className="border-b border-slate-100"><td className="p-2">{emp.name} <span className="text-slate-400">({emp.role})</span></td><td className="p-2 text-center">{emp.daysInRange}</td><td className="p-2 text-right font-mono">{formatCurrency(emp.totalCost)}</td></tr>))}
                            </tbody>
                        </table>

                        <h3 className="text-xs font-black uppercase border-b mb-3 pb-1 mt-8">Apontamento de Equipamentos</h3>
                        <table className="w-full text-xs text-left mb-8 border-collapse">
                            <thead className="bg-slate-100 font-bold"><tr><th className="p-2">Data</th><th className="p-2">Equipamento</th><th className="p-2 text-right">Custo Diária</th></tr></thead>
                            <tbody>
                                {equipmentDetails.map((item, idx) => (<tr key={idx} className="border-b border-slate-100">
                                        <td className="p-2">{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="p-2">{item.prefix}</td>
                                        <td className="p-2 text-right font-mono">{formatCurrency(item.cost)}</td>
                                    </tr>))}
                                {equipmentDetails.length === 0 && <tr><td colSpan={3} className="p-4 text-center italic text-slate-400">Sem registros de equipamentos no período.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>);
};
const CRITICAL_LEVEL = 3000;
const DashboardView = ({ machines, machinesWithIssues, recentlyReleasedMachines = [], maintenanceTasks, bridgeMaterials, bridgeEmployees, bridgeEvents, bridgeMaterialRequests, dailyLogs = [], bridgeProjects = [], usinaDeliveries = [], usinaBituminous = [], usinaProduction = [], usinaLoads = [], usinaTankCapacities = { 'CAP': 60, 'EAI': 30, 'RR-2C': 30, 'RR-1C': 30 }, fuelRecords = [], dieselDeliveries = [], notifications = [], onAddHorimetro, onSelectMachine, onOpenMaintenanceModal, onAddMachineToDashboard, onRemoveMachineFromDashboard, onUpdateMachineStatus, availableMachinesToAdd, workedHoursThisMonth, totalStoppedHoursForYear, dashboardMachineIds, onResolveIssue }) => {
    const [activeTab, setActiveTab] = useState('Oficina');
    const [showCostDetails, setShowCostDetails] = useState(false);
    const [showTopConsumersModal, setShowTopConsumersModal] = useState(false);
    // State for Reports
    const [isOficinaReportOpen, setIsOficinaReportOpen] = useState(false);
    const [isAbastecimentoReportOpen, setIsAbastecimentoReportOpen] = useState(false);
    const [isBridgeReportModalOpen, setIsBridgeReportModalOpen] = useState(false);
    // Pontes State
    const [selectedBridgeProjectId, setSelectedBridgeProjectId] = useState('');
    // States for History Filters
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date().toISOString().slice(0, 8) + '01';
    const [reportStartDate, setReportStartDate] = useState(firstDayOfMonth);
    const [reportEndDate, setReportEndDate] = useState(todayStr);
    const [filterEquipment, setFilterEquipment] = useState('all');
    const [filterPrefixSearch, setFilterPrefixSearch] = useState('');
    // NOVO ESTADO: DATA SELECIONADA NA USINA
    const [selectedUsinaDate, setSelectedUsinaDate] = useState('');
    const [downtimeClockTick, setDowntimeClockTick] = useState(() => Date.now());
    // EFFECTS
    useEffect(() => {
        if (bridgeProjects.length > 0 && !selectedBridgeProjectId) {
            setSelectedBridgeProjectId(bridgeProjects[0].id);
        }
    }, [bridgeProjects, selectedBridgeProjectId]);
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setDowntimeClockTick(Date.now());
        }, 60000);
        return () => window.clearInterval(intervalId);
    }, []);
    // CÁLCULOS OFICINA
    const workshopMetrics = useMemo(() => {
        const totalFleetCount = machines.length;
        const operatingMachines = machines.filter(m => m.status === MachineStatus.Operating).length;
        const stoppedMachines = machines.filter(m => m.status === MachineStatus.Maintenance || m.status === MachineStatus.MechanicalProblem);
        const totalHoursParada = stoppedMachines.reduce((acc, m) => acc + calculateHoursStopped(m.statusChangeDate, m.lastStatusChangeTime), 0);
        const avgHoursParada = stoppedMachines.length > 0 ? totalHoursParada / stoppedMachines.length : 0;
        return { operatingMachines, totalFleetCount, totalHoursParada, avgHoursParada };
    }, [machines, downtimeClockTick]);
    const stoppedMachines = useMemo(() => {
        return machines.filter(m => m.status === MachineStatus.Maintenance || m.status === MachineStatus.MechanicalProblem)
            .sort((a, b) => calculateDaysStopped(b.statusChangeDate, b.lastStatusChangeTime) - calculateDaysStopped(a.statusChangeDate, a.lastStatusChangeTime));
    }, [machines, downtimeClockTick]);
    // Abastecimento logic
    const tankCapacity = 15000;
    const inventoryStats = useMemo(() => {
        const totalIn = dieselDeliveries.reduce((acc, curr) => acc + curr.liters, 0);
        const totalOut = fuelRecords.reduce((acc, curr) => acc + parseFuelVolume(curr.diesel), 0);
        const currentLevel = totalIn - totalOut;
        const percentage = Math.max(0, Math.min(100, (currentLevel / tankCapacity) * 100));
        return { totalIn, totalOut, currentLevel, percentage };
    }, [dieselDeliveries, fuelRecords]);
    const fuelStats = useMemo(() => {
        const totalSpent = dieselDeliveries.reduce((acc, curr) => {
            const cost = curr.totalCost || (curr.pricePerLiter ? curr.liters * curr.pricePerLiter : 0);
            return acc + cost;
        }, 0);
        return { totalSpent };
    }, [dieselDeliveries]);
    const averageFuelPrice = useMemo(() => {
        if (inventoryStats.totalIn === 0)
            return 0;
        return fuelStats.totalSpent / inventoryStats.totalIn;
    }, [fuelStats.totalSpent, inventoryStats.totalIn]);
    const consumptionStats = useMemo(() => {
        const now = new Date();
        const monthMap = {};
        const totalMap = {};
        fuelRecords.forEach(r => {
            const val = parseFuelVolume(r.diesel);
            const fullName = [r.prefix, r.machineName].filter(Boolean).join(' - ') || 'Equipamento sem identificação';
            totalMap[fullName] = (totalMap[fullName] || 0) + val;
            const recordDate = parseFlexibleDate(r.date);
            const isCurrentMonth = recordDate &&
                recordDate.getFullYear() === now.getFullYear() &&
                recordDate.getMonth() === now.getMonth();
            if (isCurrentMonth) {
                monthMap[fullName] = (monthMap[fullName] || 0) + val;
            }
        });
        const monthList = Object.entries(monthMap)
            .map(([name, val]) => ({ name, val }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 4);
        const totalList = Object.entries(totalMap)
            .map(([name, val]) => ({ name, val }))
            .sort((a, b) => b.val - a.val);
        const topLifetime = totalList.length > 0 ? totalList[0] : null;
        const maxMonth = monthList.length > 0 ? monthList[0].val : 1;
        return { monthList, topLifetime, maxMonth, totalList };
    }, [fuelRecords]);
    const monthlyFuelCosts = useMemo(() => {
        const now = new Date();
        const results = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = d.toISOString().slice(0, 7);
            const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const monthNameShort = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            const monthlyDeliveries = dieselDeliveries.filter(del => del.date.startsWith(monthKey));
            const totalCost = monthlyDeliveries.reduce((acc, curr) => {
                const cost = curr.totalCost || (curr.pricePerLiter ? curr.liters * curr.pricePerLiter : 0);
                return acc + cost;
            }, 0);
            const totalLiters = monthlyDeliveries.reduce((acc, curr) => acc + curr.liters, 0);
            results.push({ month: monthNameShort, cost: totalCost, liters: totalLiters });
        }
        return results;
    }, [dieselDeliveries]);
    const filteredRecords = useMemo(() => {
        const normalizedPrefix = filterPrefixSearch.trim().toLowerCase();
        return fuelRecords.filter(r => {
            const inDateRange = r.date >= reportStartDate && r.date <= reportEndDate;
            const matchesEquipment = filterEquipment === 'all' || r.prefix === filterEquipment;
            const matchesPrefix = !normalizedPrefix || String(r.prefix || '').toLowerCase().includes(normalizedPrefix);
            return inDateRange && matchesEquipment && matchesPrefix;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [fuelRecords, reportStartDate, reportEndDate, filterEquipment, filterPrefixSearch]);
    const totalConsumptionForHistory = useMemo(() => {
        return filteredRecords.reduce((acc, record) => acc + parseFuelVolume(record.diesel), 0);
    }, [filteredRecords]);
    const historyRankingStats = useMemo(() => {
        const rankingMap = {};
        filteredRecords.forEach((record) => {
            const liters = parseFuelVolume(record.diesel);
            const fullName = [record.prefix, record.machineName].filter(Boolean).join(' - ') || 'Equipamento sem identificação';
            rankingMap[fullName] = (rankingMap[fullName] || 0) + liters;
        });
        const list = Object.entries(rankingMap)
            .map(([name, val]) => ({ name, val }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 4);
        const max = list.length > 0 ? list[0].val : 1;
        return { list, max };
    }, [filteredRecords]);
    const uniqueEquipment = useMemo(() => {
        const allPrefixes = fuelRecords.map(r => r.prefix);
        return Array.from(new Set(allPrefixes)).sort();
    }, [fuelRecords]);
    const currentBridgeProject = bridgeProjects.find(p => p.id === selectedBridgeProjectId);
    const bridgeProjectTotals = useMemo(() => {
        if (!selectedBridgeProjectId)
            return { matCost: 0, labCost: 0, equipCost: 0, total: 0 };
        const projMaterials = bridgeMaterials.filter(m => m.bridgeProjectId === selectedBridgeProjectId);
        const projEmployees = bridgeEmployees.filter(e => e.bridgeProjectId === selectedBridgeProjectId);
        const projLogs = dailyLogs.filter(log => log.bridgeProjectId === selectedBridgeProjectId);
        const matCost = projMaterials.reduce((acc, curr) => acc + curr.totalValue, 0);
        const labCost = projEmployees.reduce((acc, curr) => {
            const days = getDaysWorked(curr.startDate, curr.terminationDate);
            const dailyRate = curr.salary / 30;
            const basic = dailyRate * days;
            const foodDays = calculateFoodChargeDays(curr, curr.startDate, curr.terminationDate || new Date().toISOString().split('T')[0]);
            const food = ((curr.breakfastCost || 0) + (curr.lunchCost || 0) + (curr.dinnerCost || 0)) * foodDays;
            return acc + basic + (curr.totalAdditionalCost || 0) + food;
        }, 0);
        const equipCost = projLogs.reduce((acc, log) => acc + log.equipmentList.reduce((dayAcc, eq) => dayAcc + (eq.dailyCost || 0), 0), 0);
        return { matCost, labCost, equipCost, total: matCost + labCost + equipCost };
    }, [selectedBridgeProjectId, bridgeMaterials, bridgeEmployees, dailyLogs]);
    const selectedProjectLogs = dailyLogs.filter(log => log.bridgeProjectId === selectedBridgeProjectId).sort((a, b) => b.date.localeCompare(a.date));
    const bituStats = useMemo(() => {
        const stats = {
            'CAP': { in: 0, out: 0, balance: 0 },
            'EAI': { in: 0, out: 0, balance: 0 },
            'RR-2C': { in: 0, out: 0, balance: 0 },
            'RR-1C': { in: 0, out: 0, balance: 0 },
        };
        (usinaBituminous || []).forEach(d => { if (stats[d.product])
            stats[d.product].in += d.tons; });
        (usinaProduction || []).forEach(log => { stats['CAP'].out += log.capConsumed; });
        Object.keys(stats).forEach(key => { stats[key].balance = stats[key].in - stats[key].out; });
        return stats;
    }, [usinaBituminous, usinaProduction]);
    const avgTemp = useMemo(() => {
        if (!usinaLoads || usinaLoads.length === 0)
            return 0;
        const total = usinaLoads.reduce((acc, curr) => acc + curr.temperature, 0);
        return (total / usinaLoads.length).toFixed(1);
    }, [usinaLoads]);
    const sortedUsinaDeliveries = useMemo(() => [...(usinaDeliveries || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [usinaDeliveries]);
    const sortedBituDeliveries = useMemo(() => [...(usinaBituminous || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [usinaBituminous]);
    const sortedProduction = useMemo(() => [...(usinaProduction || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [usinaProduction]);
    const availableUsinaDates = useMemo(() => {
        const dates = new Set();
        (usinaProduction || []).forEach(p => dates.add(p.date));
        (usinaLoads || []).forEach(l => dates.add(l.date));
        return Array.from(dates).sort().reverse();
    }, [usinaProduction, usinaLoads]);
    useEffect(() => {
        if (availableUsinaDates.length > 0 && !selectedUsinaDate) {
            setSelectedUsinaDate(availableUsinaDates[0]);
        }
    }, [availableUsinaDates, selectedUsinaDate]);
    const displayUsinaDate = selectedUsinaDate || (availableUsinaDates.length > 0 ? availableUsinaDates[0] : new Date().toISOString().split('T')[0]);
    const latestProd = useMemo(() => (usinaProduction || []).find(p => p.date === displayUsinaDate) || null, [usinaProduction, displayUsinaDate]);
    const latestLoads = useMemo(() => (usinaLoads || []).filter(l => l.date === displayUsinaDate), [usinaLoads, displayUsinaDate]);
    const getMotivoForReport = (machine) => {
        if (machine.paralisacaoMotivo)
            return machine.paralisacaoMotivo;
        if (machine.status === MachineStatus.Maintenance) {
            const relevantTask = maintenanceTasks.find(t => t.machineId === machine.id);
            if (relevantTask)
                return relevantTask.task;
        }
        return machine.status;
    };
    const generateOficinaPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18);
        doc.text("Relatório - Gestão do Pátio (Oficina)", 14, 20);
        doc.setFontSize(10);
        doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
        const tableBody = stoppedMachines.map(m => {
            const durationString = calculateDurationString(m.statusChangeDate, m.lastStatusChangeTime);
            return [
                m.prefix,
                `${m.name} ${m.model}`,
                m.statusChangeDate ? new Date(m.statusChangeDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
                getMotivoForReport(m),
                m.situation || '-',
                m.responsavel || '-',
                durationString, // New format
                m.releaseForecastDate ? new Date(m.releaseForecastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'
            ];
        });
        autoTable(doc, {
            startY: 32,
            head: [['Prefixo', 'Equipamento', 'Data Paralisação', 'Motivo', 'Situação', 'Responsável', 'Tempo Pátio (Útil)', 'Previsão Saída']],
            body: tableBody,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 6) {
                    // Parsing duration string for color logic if needed, e.g. "15d 2h"
                    const daysMatch = data.cell.raw.match(/(\d+)d/);
                    const days = daysMatch ? parseInt(daysMatch[1]) : 0;
                    if (days > 20) {
                        data.cell.styles.fillColor = [239, 68, 68];
                        data.cell.styles.textColor = [255, 255, 255];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    else if (days > 10) {
                        data.cell.styles.fillColor = [245, 158, 11];
                        data.cell.styles.textColor = [0, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });
        doc.save("relatorio_patio_oficina.pdf");
    };
    const generateAbastecimentoPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Relatório de Controle de Abastecimento", 14, 20);
        doc.setFontSize(10);
        doc.text(`Período: ${new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(reportEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 28);
        const totalConsumedInRange = filteredRecords.reduce((acc, r) => acc + parseFuelVolume(r.diesel), 0);
        doc.setFontSize(12);
        doc.text("Resumo do Período", 14, 40);
        autoTable(doc, {
            startY: 42,
            head: [['Nível Atual Tanque', 'Entradas (Total)', 'Consumo no Período', 'Total Registros']],
            body: [[
                    `${inventoryStats.currentLevel.toLocaleString('pt-BR')} L`,
                    `${inventoryStats.totalIn.toLocaleString('pt-BR')} L`,
                    `${totalConsumedInRange.toLocaleString('pt-BR')} L`,
                    filteredRecords.length.toString()
                ]],
            theme: 'plain',
            headStyles: { fontStyle: 'bold', fillColor: [220, 220, 220] }
        });
        doc.text("Detalhamento de Abastecimentos", 14, doc.lastAutoTable.finalY + 10);
        const tableBody = filteredRecords.map(r => [
            new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR'),
            r.prefix,
            r.machineName,
            r.diesel + ' L',
            r.h_km
        ]);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 12,
            head: [['Data', 'Prefixo', 'Equipamento', 'Volume', 'Horímetro']],
            body: tableBody,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });
        doc.save(`relatorio_abastecimento_${reportStartDate}_a_${reportEndDate}.pdf`);
    };
    return (<div className="space-y-6">
      <div className="flex space-x-2 border-b border-slate-700 pb-2 overflow-x-auto text-sm">
          <button onClick={() => setActiveTab('Oficina')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors font-semibold whitespace-nowrap ${activeTab === 'Oficina' ? 'bg-brand-accent text-brand-primary' : 'text-brand-muted hover:text-brand-light hover:bg-slate-700'}`}><WrenchIcon className="w-5 h-5"/> Oficina</button>
          <button onClick={() => setActiveTab('Abastecimentos')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors font-semibold whitespace-nowrap ${activeTab === 'Abastecimentos' ? 'bg-brand-accent text-brand-primary' : 'text-brand-muted hover:text-brand-light hover:bg-slate-700'}`}><FuelIcon className="w-5 h-5"/> Abastecimentos</button>
          <button onClick={() => setActiveTab('Pontes')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors font-semibold whitespace-nowrap ${activeTab === 'Pontes' ? 'bg-brand-accent text-brand-primary' : 'text-brand-muted hover:text-brand-light hover:bg-slate-700'}`}><BridgeIcon className="w-5 h-5"/> Pontes</button>
          <button onClick={() => setActiveTab('Usina')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors font-semibold whitespace-nowrap ${activeTab === 'Usina' ? 'bg-brand-accent text-brand-primary' : 'text-brand-muted hover:text-brand-light hover:bg-slate-700'}`}><FactoryIcon className="w-5 h-5"/> Usina de Asfalto</button>
      </div>

      {activeTab === 'Oficina' && (<div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Equipamentos Operando" value={`${workshopMetrics.operatingMachines} / ${workshopMetrics.totalFleetCount}`} icon={<GraderIcon className="w-8 h-8"/>} color="text-green-400"/>
                <MetricCard title="Somatório de tempo na oficina" value={`${workshopMetrics.totalHoursParada.toLocaleString('pt-BR')} h`} icon={<WrenchIcon className="w-8 h-8"/>} color="text-red-400"/>
                <MetricCard title="Perm. Média (h)" value={`${workshopMetrics.avgHoursParada.toFixed(0)} h`} icon={<ClockIcon className="w-8 h-8"/>} color="text-blue-400"/>
                <MetricCard title="Horas Trab. (Mês)" value={`${workedHoursThisMonth.toLocaleString('pt-BR')} h`} icon={<ChartIcon className="w-8 h-8"/>} color="text-indigo-400"/>
            </div>
            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg flex flex-col">
                <h3 className="text-sm font-bold text-brand-muted uppercase mb-4 tracking-widest">Gestão do Pátio (Atual)</h3>
                <OficinaSummary machines={stoppedMachines} maintenanceTasks={maintenanceTasks} recentlyReleasedMachines={recentlyReleasedMachines}/>
            </div>

            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-red-500">
                <h3 className="text-lg font-black text-brand-light uppercase mb-6 flex items-center gap-2 tracking-tighter"><ClockIcon className="w-6 h-6 text-red-400"/> Ranking Downtime (Permanência no Pátio)</h3>
                {stoppedMachines.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {stoppedMachines.map(m => {
                    const days = calculateDaysStopped(m.statusChangeDate, m.lastStatusChangeTime);
                    const durationString = calculateDurationString(m.statusChangeDate, m.lastStatusChangeTime);
                    const fullMachineName = `${m.name || ''} ${m.model || ''}`.trim();
                    const percent = Math.min(100, (days / 30) * 100);
                    return (<div key={m.id} className="bg-brand-primary p-4 rounded-xl border border-slate-700/50 hover:border-red-500/30 transition-all group">
                                    <div className="flex justify-between items-center text-xs mb-3">
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-black text-brand-accent uppercase tracking-wider break-words" title={m.prefix}>{m.prefix}</span>
                                            <span className="text-brand-light font-bold text-[11px] leading-tight whitespace-normal break-words" title={fullMachineName}>{fullMachineName}</span>
                                        </div>
                                        <div className="text-right shrink-0"><span className="font-black text-red-400 text-lg leading-none">{durationString}</span><span className="text-[9px] text-brand-muted uppercase block font-black">úteis</span></div>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden"><div className={`h-full transition-all duration-1000 ${days > 15 ? 'bg-red-500' : days > 7 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div></div>
                                </div>);
                })}
                    </div>) : (<div className="py-12 text-center text-brand-muted italic uppercase tracking-widest bg-brand-primary/20 rounded-xl border border-dashed border-slate-700">Nenhum equipamento parado no momento</div>)}
            </div>

            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-blue-500">
                <h3 className="text-lg font-black text-brand-light uppercase mb-6 flex items-center gap-2 tracking-tighter"><HistoryIcon className="w-6 h-6 text-blue-500"/> Atividades Recentes da Oficina</h3>
                <div className="w-full"><WorkshopActivityTimeline machines={machines} limit={15} activityFeed={notifications}/></div>
            </div>

            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold text-brand-light mb-4">Visão Geral dos Equipamentos</h3>
                <MachineList
                    machines={machines}
                    maintenanceTasks={maintenanceTasks}
                    viewMode="em_campo"
                    readOnly={true}
                    availableMachinesToAdd={availableMachinesToAdd}
                    onAddHorimetro={onAddHorimetro}
                    onSelectMachine={onSelectMachine}
                    onAddMachineToDashboard={onAddMachineToDashboard}
                    onRemoveMachineFromDashboard={onRemoveMachineFromDashboard}
                    onUpdateMachineStatus={onUpdateMachineStatus}
                    dashboardMachineIds={dashboardMachineIds}
                />
            </div>

            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-lg font-bold text-brand-light flex items-center gap-2">
                        <PrinterIcon className="w-6 h-6 text-brand-accent"/>
                        Relatório de Gestão de Pátio
                    </h3>
                    <p className="text-sm text-brand-muted mt-1">Gere um documento PDF detalhado com os equipamentos parados, motivos e previsões de saída.</p>
                </div>
                <button onClick={() => setIsOficinaReportOpen(true)} className="bg-brand-primary hover:bg-slate-800 text-brand-light border border-slate-600 px-6 py-3 rounded-lg text-xs font-bold uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap">
                    <PrinterIcon className="w-4 h-4 text-brand-accent"/>
                    Visualizar Relatório (PDF)
                </button>
            </div>

            {isOficinaReportOpen && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-brand-secondary rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-600 animate-in zoom-in-95 duration-200">
                        <div className="bg-brand-primary p-4 border-b border-slate-600 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-brand-light flex items-center gap-2">
                                    <PrinterIcon className="w-6 h-6 text-brand-accent"/> Relatório de Equipamentos em Pátio
                                </h2>
                                <p className="text-xs text-brand-muted uppercase tracking-widest mt-1">Pré-visualização de Documento</p>
                            </div>
                            <button onClick={() => setIsOficinaReportOpen(false)} className="text-brand-muted hover:text-brand-light p-2 rounded-full hover:bg-slate-700 transition-all"><XMarkIcon className="w-6 h-6"/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white text-slate-800">
                            <div className="border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-end">
                                <div>
                                    <h1 className="text-2xl font-black uppercase text-slate-900">Relatório de Oficina</h1>
                                    <p className="text-sm font-bold text-slate-500">Status do Pátio e Previsões</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Data de Referência</p>
                                    <p className="text-lg font-black text-slate-800">{new Date().toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>

                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-slate-800 text-white uppercase font-bold">
                                    <tr>
                                        <th className="p-3 text-left">Prefixo</th>
                                        <th className="p-3 text-left">Equipamento</th>
                                        <th className="p-3 text-center">Data Paralisação</th>
                                        <th className="p-3 text-left">Motivo</th>
                                        <th className="p-3 text-left">Situação</th>
                                        <th className="p-3 text-center">Responsável</th>
                                        <th className="p-3 text-center">Tempo Pátio (Útil)</th>
                                        <th className="p-3 text-center">Previsão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {stoppedMachines.length > 0 ? stoppedMachines.map((m, idx) => {
                    const days = calculateDaysStopped(m.statusChangeDate, m.lastStatusChangeTime);
                    const durationString = calculateDurationString(m.statusChangeDate, m.lastStatusChangeTime);
                    const isRed = days > 20;
                    const isYellow = days > 10 && days <= 20;
                    return (<tr key={m.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                                <td className="p-3 font-bold text-slate-900">{m.prefix}</td>
                                                <td className="p-3">{m.name} {m.model}</td>
                                                <td className="p-3 text-center font-mono">{m.statusChangeDate ? new Date(m.statusChangeDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                                                <td className="p-3 italic">{getMotivoForReport(m)}</td>
                                                <td className="p-3">{m.situation || '-'}</td>
                                                <td className="p-3 text-center uppercase text-[10px] font-bold">{m.responsavel || '-'}</td>
                                                <td className={`p-3 text-center font-bold ${isRed ? 'bg-red-500 text-white' : isYellow ? 'bg-amber-400 text-slate-900' : 'text-slate-700'}`}>
                                                    {durationString}
                                                </td>
                                                <td className="p-3 text-center font-mono">{m.releaseForecastDate ? new Date(m.releaseForecastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                                            </tr>);
                }) : (<tr><td colSpan={8} className="p-8 text-center text-slate-400 italic font-bold">Nenhum equipamento no pátio.</td></tr>)}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-brand-primary p-4 border-t border-slate-600 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsOficinaReportOpen(false)} className="px-6 py-2 bg-slate-700 text-brand-light font-bold rounded-lg hover:bg-slate-600 uppercase text-xs">Fechar</button>
                            <button onClick={generateOficinaPDF} className="px-6 py-2 bg-brand-accent text-brand-primary font-black rounded-lg hover:brightness-110 flex items-center gap-2 uppercase text-xs shadow-lg">
                                <PrinterIcon className="w-4 h-4"/> Baixar PDF
                            </button>
                        </div>
                    </div>
                </div>)}
        </div>)}

      {activeTab === 'Abastecimentos' && (<div className="space-y-6 animate-in fade-in duration-300 relative">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 bg-brand-secondary p-6 rounded-lg shadow-lg border border-slate-700 flex flex-col items-center relative">
                      <div className="flex justify-between items-center w-full mb-4">
                          <h4 className="text-sm font-bold text-brand-muted uppercase text-center flex-1 ml-6">Nível do Tanque Principal</h4>
                      </div>

                      <div className="relative w-32 h-64 bg-slate-800 rounded-3xl border-4 border-slate-600 overflow-hidden shadow-inner flex items-end">
                          <div className={`w-full transition-all duration-1000 ease-in-out relative ${inventoryStats.currentLevel < CRITICAL_LEVEL ? 'bg-red-500' : 'bg-blue-500'}`} style={{ height: `${inventoryStats.percentage}%` }}>
                              <div className="absolute top-0 left-0 w-full h-4 bg-white/20 -translate-y-2 animate-pulse rounded-full blur-sm"></div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-white drop-shadow-md">{Math.round(inventoryStats.percentage)}%</span></div>
                      </div>
                      <div className="mt-6 text-center">
                          <p className="text-2xl font-bold text-brand-light">{inventoryStats.currentLevel.toLocaleString('pt-BR')} L</p>
                          <p className="text-xs text-brand-muted uppercase tracking-wider">Volume Disponível</p>
                          {inventoryStats.currentLevel < CRITICAL_LEVEL && (<div className="mt-3 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full animate-bounce">
                                  <span className="text-red-400 text-[10px] font-black uppercase">Fazer Novo Pedido</span>
                              </div>)}
                      </div>
                  </div>

                  <div className="lg:col-span-8 flex flex-col gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-brand-secondary p-4 rounded-lg border border-slate-700">
                              <span className="text-[10px] text-brand-muted uppercase font-bold block mb-1">Capacidade Nominal</span>
                              <div className="flex items-center gap-2"><CubeIcon className="w-5 h-5 text-slate-500"/><span className="text-xl font-bold text-brand-light">{tankCapacity.toLocaleString('pt-BR')} L</span></div>
                          </div>
                          <div className="bg-brand-secondary p-4 rounded-lg border border-slate-700">
                              <span className="text-[10px] text-brand-muted uppercase font-bold block mb-1">Entradas (Total)</span>
                              <div className="flex items-center gap-2"><ArrowUpIcon className="w-5 h-5 text-green-400"/><span className="text-xl font-bold text-green-400">{inventoryStats.totalIn.toLocaleString('pt-BR')} L</span></div>
                          </div>
                          <div className="bg-brand-secondary p-4 rounded-lg border border-slate-700">
                              <span className="text-[10px] text-brand-muted uppercase font-bold block mb-1">Saídas (Total)</span>
                              <div className="flex items-center gap-2"><ArrowDownIcon className="w-5 h-5 text-red-400"/><span className="text-xl font-bold text-red-400">{inventoryStats.totalOut.toLocaleString('pt-BR')} L</span></div>
                          </div>
                      </div>

                      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-green-500 flex-1">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><TruckIcon className="w-5 h-5 text-green-400"/> Recebimento de Carga</h4>
                          </div>
                          <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                              <table className="min-w-full text-xs text-left text-brand-muted">
                                  <thead className="bg-slate-800 text-brand-light uppercase sticky top-0"><tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Fornecedor</th><th className="px-4 py-2 text-right">Volume</th><th className="px-4 py-2 text-right">Preço Un.</th><th className="px-4 py-2 text-right">Total (R$)</th></tr></thead>
                                  <tbody className="divide-y divide-slate-700">
                                      {dieselDeliveries.map(del => (<tr key={del.id} className="hover:bg-slate-700/50">
                                              <td className="px-4 py-2">{new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                              <td className="px-4 py-2">{del.supplier} <span className="text-[10px] opacity-50">{del.ticketNumber}</span></td>
                                              <td className="px-4 py-2 text-right font-bold text-green-400">+{del.liters} L</td>
                                              <td className="px-4 py-2 text-right">{del.pricePerLiter ? `R$ ${del.pricePerLiter.toFixed(2)}` : '-'}</td>
                                              <td className="px-4 py-2 text-right font-mono text-brand-accent">{del.totalCost ? `R$ ${del.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                                          </tr>))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div onClick={() => setShowCostDetails(true)} className="cursor-pointer transition-transform hover:scale-105 active:scale-95">
                    <MetricCard title="Custo Total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fuelStats.totalSpent)} icon={<ChartIcon className="w-8 h-8"/>} color="text-green-400"/>
                  </div>
                  <MetricCard title="Consumo Total" value={`${totalConsumptionForHistory.toLocaleString('pt-BR')} L`} icon={<DropIcon className="w-8 h-8"/>} color="text-orange-400"/>
                  <MetricCard title="Preço Médio / Litro" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(averageFuelPrice)} icon={<ShoppingCartIcon className="w-8 h-8"/>} color="text-yellow-400"/>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-brand-secondary p-6 rounded-lg shadow-lg border-l-4 border-orange-500">
                      <h4 className="text-lg font-bold text-brand-light mb-4 flex items-center gap-2">
                          <ChartIcon className="w-5 h-5 text-orange-400"/> Ranking de Consumo (Mês)
                      </h4>
                      <div className="space-y-4">
                          {historyRankingStats.list.map((item, idx) => (<div key={idx} className="relative">
                                  <div className="flex justify-between items-end mb-1 text-xs">
                                      <span className="font-bold text-brand-light uppercase">{item.name}</span>
                                      <span className="font-mono font-black text-brand-accent">{item.val.toLocaleString('pt-BR')} L</span>
                                  </div>
                                  <div className="w-full bg-brand-primary h-2 rounded-full overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400" style={{ width: `${(item.val / historyRankingStats.max) * 100}%` }}></div>
                                  </div>
                              </div>))}
                          {historyRankingStats.list.length === 0 && <p className="text-brand-muted italic text-sm">Sem consumo no período filtrado.</p>}
                      </div>
                  </div>

                  <div onClick={() => setShowTopConsumersModal(true)} className="lg:col-span-1 bg-brand-secondary p-6 rounded-lg shadow-lg border-l-4 border-purple-500 flex flex-col justify-center relative overflow-hidden group cursor-pointer hover:bg-slate-700 transition-colors">
                      <div className="absolute -right-6 -top-6 bg-purple-500/10 w-32 h-32 rounded-full group-hover:scale-110 transition-transform"></div>
                      <h4 className="text-sm font-bold text-brand-muted uppercase tracking-widest mb-1 relative z-10 flex items-center gap-2">
                          Maior Consumidor (Obra) 
                          <span className="bg-purple-500/30 text-purple-200 text-[9px] px-1.5 py-0.5 rounded ml-auto border border-purple-500/50 group-hover:bg-purple-500 group-hover:text-white transition-colors">Ver Top 10</span>
                      </h4>
                      {consumptionStats.topLifetime ? (<div className="relative z-10 mt-2">
                              <p className="text-2xl font-black text-brand-light uppercase leading-none mb-1 line-clamp-2">{consumptionStats.topLifetime.name}</p>
                              <p className="text-4xl font-black text-purple-400 tracking-tighter">{consumptionStats.topLifetime.val.toLocaleString('pt-BR')}<span className="text-lg text-brand-muted ml-1">L</span></p>
                              <div className="mt-4 inline-block bg-purple-500/20 text-purple-300 px-3 py-1 rounded text-[10px] font-black uppercase border border-purple-500/30">
                                  Desde o início
                              </div>
                          </div>) : (<p className="text-brand-muted italic relative z-10">Sem dados registrados.</p>)}
                  </div>
              </div>

              {showCostDetails && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowCostDetails(false)}>
                      <div className="bg-brand-secondary rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-600 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                          <div className="bg-brand-primary p-4 border-b border-slate-700 flex justify-between items-center">
                              <h4 className="text-sm font-black text-brand-light uppercase tracking-wider flex items-center gap-2">
                                  <ChartIcon className="w-4 h-4 text-green-400"/>
                                  Custo Contratado (12 Meses)
                              </h4>
                              <button onClick={() => setShowCostDetails(false)} className="text-brand-muted hover:text-brand-light transition-colors"><XMarkIcon className="w-5 h-5"/></button>
                          </div>
                          <div className="p-4 max-h-[60vh] overflow-y-auto">
                              <ul className="space-y-3">
                                  {monthlyFuelCosts.map((item, index) => (<li key={index} className="flex justify-between items-center text-xs border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                          <div className="flex flex-col">
                                              <span className="font-bold text-brand-light">{item.month}</span>
                                              <span className="text-[10px] text-brand-muted">{item.liters.toLocaleString('pt-BR')} Litros</span>
                                          </div>
                                          <span className={`font-mono font-bold ${item.cost > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cost)}
                                          </span>
                                      </li>))}
                              </ul>
                          </div>
                      </div>
                  </div>)}

              {showTopConsumersModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowTopConsumersModal(false)}>
                      <div className="bg-brand-secondary rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-600 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                          <div className="bg-brand-primary p-4 border-b border-slate-700 flex justify-between items-center">
                              <h4 className="text-lg font-bold text-brand-light flex items-center gap-2">
                                  <FuelIcon className="w-5 h-5 text-purple-400"/>
                                  Top 10 Consumidores (Obra)
                              </h4>
                              <button onClick={() => setShowTopConsumersModal(false)} className="text-brand-muted hover:text-brand-light transition-colors"><XMarkIcon className="w-6 h-6"/></button>
                          </div>
                          <div className="p-4 max-h-[70vh] overflow-y-auto">
                              <div className="space-y-4">
                                  {consumptionStats.topLifetime ? consumptionStats.totalList.slice(0, 10).map((item, idx) => {
                    // Calculate percentage based on the #1 consumer
                    const maxVal = consumptionStats.totalList[0].val;
                    const percent = (item.val / maxVal) * 100;
                    return (<div key={idx} className="relative">
                                              <div className="flex justify-between items-end mb-1 text-xs">
                                                  <span className="font-bold text-brand-light uppercase flex gap-2">
                                                      <span className="text-brand-muted font-mono w-4">#{idx + 1}</span>
                                                      {item.name}
                                                  </span>
                                                  <span className="font-mono font-black text-brand-accent">{item.val.toLocaleString('pt-BR')} L</span>
                                              </div>
                                              <div className="w-full bg-brand-primary h-2.5 rounded-full overflow-hidden border border-slate-700">
                                                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${percent}%` }}></div>
                                              </div>
                                          </div>);
                }) : (<p className="text-brand-muted italic text-center">Sem dados registrados.</p>)}
                              </div>
                          </div>
                      </div>
                  </div>)}

              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                  <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] xl:items-start mb-6 gap-4">
                      <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-brand-accent"/> Histórico de Abastecimentos</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-end gap-3 bg-brand-primary p-3 rounded-xl border border-slate-700 shadow-inner">
                          <div className="w-full min-w-0">
                              <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Equipamento</label>
                              <select value={filterEquipment} onChange={e => setFilterEquipment(e.target.value)} className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 pr-8 py-2 text-xs outline-none w-full min-w-0 truncate appearance-none">
                                  <option value="all">Todos os Equipamentos</option>
                                  {uniqueEquipment.map(prefix => (<option key={prefix} value={prefix}>{prefix}</option>))}
                              </select>
                          </div>
                          <div className="w-full min-w-0">
                              <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Início</label>
                              <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 py-2 text-xs outline-none w-full"/>
                          </div>
                          <div className="w-full min-w-0">
                              <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Fim</label>
                              <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 py-2 text-xs outline-none w-full"/>
                          </div>
                          <div className="w-full min-w-0">
                              <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Prefixo</label>
                              <input
                                  type="text"
                                  value={filterPrefixSearch}
                                  onChange={e => setFilterPrefixSearch(e.target.value)}
                                  placeholder="Ex: KKK-1234"
                                  className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 py-2 text-xs outline-none w-full"
                              />
                          </div>
                      </div>
                  </div>
                  
                  <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                      <table className="min-w-full table-fixed text-sm text-left text-brand-muted">
                          <colgroup>
                              <col className="w-[14%]" />
                              <col className="w-[14%]" />
                              <col className="w-[28%]" />
                              <col className="w-[14%]" />
                              <col className="w-[30%]" />
                          </colgroup>
                          <thead className="bg-slate-800 text-brand-light uppercase sticky top-0 z-10">
                              <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Prefixo</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3 text-right">Diesel (L)</th><th className="px-4 py-3">Observações</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                              {filteredRecords.map(record => (<tr key={record.id} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="px-4 py-3 font-bold text-brand-accent truncate">{record.prefix}</td>
                                    <td className="px-4 py-3 truncate">{record.machineName}</td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-400">{record.diesel}</td>
                                    <td className="px-4 py-3 text-brand-muted text-xs truncate">{record.details || '-'}</td>
                                </tr>))}
                              {filteredRecords.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center italic text-brand-muted">Nenhum registro encontrado para os filtros aplicados.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div>
                      <h3 className="text-lg font-bold text-brand-light flex items-center gap-2">
                          <PrinterIcon className="w-6 h-6 text-brand-accent"/>
                          Relatório de Abastecimentos
                      </h3>
                      <p className="text-sm text-brand-muted mt-1">Gere um documento PDF com o histórico de consumo filtrado pelo período e equipamentos selecionados acima.</p>
                  </div>
                  <button onClick={() => setIsAbastecimentoReportOpen(true)} className="bg-brand-primary hover:bg-slate-800 text-brand-light border border-slate-600 px-6 py-3 rounded-lg text-xs font-bold uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap">
                      <PrinterIcon className="w-4 h-4 text-brand-accent"/>
                      Visualizar Relatório (PDF)
                  </button>
              </div>

              {isAbastecimentoReportOpen && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 transition-opacity">
                      <div className="bg-brand-secondary rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-600 animate-in zoom-in-95 duration-200">
                          <div className="bg-brand-primary p-4 border-b border-slate-600 flex justify-between items-center shrink-0">
                              <div>
                                  <h2 className="text-xl font-bold text-brand-light flex items-center gap-2">
                                      <PrinterIcon className="w-6 h-6 text-brand-accent"/> Relatório de Controle de Abastecimento
                                  </h2>
                                  <p className="text-xs text-brand-muted uppercase tracking-widest mt-1">Pré-visualização de Documento</p>
                              </div>
                              <button onClick={() => setIsAbastecimentoReportOpen(false)} className="text-brand-muted hover:text-brand-light p-2 rounded-full hover:bg-slate-700 transition-all"><XMarkIcon className="w-6 h-6"/></button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6 bg-white text-slate-800">
                              <div className="border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-end">
                                  <div>
                                      <h1 className="text-2xl font-black uppercase text-slate-900">Relatório de Abastecimentos</h1>
                                      <p className="text-sm font-bold text-slate-500">Histórico de Consumo e Status do Tanque</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-xs font-bold text-slate-400 uppercase">Período Selecionado</p>
                                      <p className="text-lg font-black text-slate-800">
                                          {new Date(reportStartDate + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(reportEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                      </p>
                                  </div>
                              </div>

                              <div className="grid grid-cols-4 gap-4 mb-8">
                                  <div className="bg-slate-100 p-3 rounded border">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Nível Tanque Atual</span>
                                      <span className="text-lg font-bold text-blue-600">{inventoryStats.currentLevel.toLocaleString('pt-BR')} L</span>
                                  </div>
                                  <div className="bg-slate-100 p-3 rounded border">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Entradas (Geral)</span>
                                      <span className="text-lg font-bold text-green-600">{inventoryStats.totalIn.toLocaleString('pt-BR')} L</span>
                                  </div>
                                  <div className="bg-slate-100 p-3 rounded border">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Consumo no Período</span>
                                      <span className="text-lg font-bold text-amber-600">
                                          {filteredRecords.reduce((acc, r) => acc + parseFuelVolume(r.diesel), 0).toLocaleString('pt-BR')} L
                                      </span>
                                  </div>
                                  <div className="bg-slate-800 p-3 rounded text-white">
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Registros</span>
                                      <span className="text-lg font-bold text-brand-accent">{filteredRecords.length}</span>
                                  </div>
                              </div>

                              <h3 className="text-xs font-black uppercase border-b mb-3 pb-1">Detalhamento dos Lançamentos</h3>
                              <table className="w-full text-xs text-left mb-8 border-collapse">
                                  <thead className="bg-slate-800 text-white font-bold">
                                      <tr>
                                          <th className="p-3">Data</th>
                                          <th className="p-3">Prefixo</th>
                                          <th className="p-3">Equipamento</th>
                                          <th className="p-3 text-right">Volume (L)</th>
                                          <th className="p-3 text-center">Horímetro</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                      {filteredRecords.map((r, idx) => (<tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                              <td className="p-3">{new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                              <td className="p-3 font-bold">{r.prefix}</td>
                                              <td className="p-3">{r.machineName}</td>
                                              <td className="p-3 text-right font-mono font-bold text-slate-700">{r.diesel} L</td>
                                              <td className="p-3 text-center">{r.h_km}</td>
                                          </tr>))}
                                      {filteredRecords.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic font-bold">Nenhum registro encontrado neste período.</td></tr>}
                                  </tbody>
                              </table>
                          </div>

                          <div className="bg-brand-primary p-4 border-t border-slate-600 flex justify-end gap-3 shrink-0">
                              <button onClick={() => setIsAbastecimentoReportOpen(false)} className="px-6 py-2 bg-slate-700 text-brand-light font-bold rounded-lg hover:bg-slate-600 uppercase text-xs">Fechar</button>
                              <button onClick={generateAbastecimentoPDF} className="px-6 py-2 bg-brand-accent text-brand-primary font-black rounded-lg hover:brightness-110 flex items-center gap-2 uppercase text-xs shadow-lg">
                                  <PrinterIcon className="w-4 h-4"/> Baixar PDF
                              </button>
                          </div>
                      </div>
                  </div>)}
          </div>)}

      {activeTab === 'Pontes' && (
        // ... (Pontes content same)
        <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header com Seletor (Novo) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-secondary p-4 rounded-xl border border-slate-700 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-accent/20 p-2 rounded-lg"><BridgeIcon className="w-8 h-8 text-brand-accent"/></div>
                    <div>
                        <h3 className="text-xl font-bold text-brand-light">Gestão de Pontes</h3>
                        <p className="text-[10px] text-brand-muted uppercase font-black tracking-widest">Controle de Projetos e Custos</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={selectedBridgeProjectId} onChange={(e) => setSelectedBridgeProjectId(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light font-bold rounded-lg px-4 py-2 outline-none min-w-[240px]">
                        {bridgeProjects.length === 0 && <option value="" disabled>Sem projetos...</option>}
                        {bridgeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button className="bg-brand-accent text-brand-primary p-2 rounded-lg hover:brightness-110 shadow-lg transition-all" title="Novo Projeto (Gerenciar em Pontes)"><PlusIcon className="w-5 h-5"/></button>
                </div>
              </div>

              {/* Cards de Métricas (Novos - Substituindo os antigos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard title="Custos Materiais" value={formatCurrency(bridgeProjectTotals.matCost)} icon={<CubeIcon className="w-8 h-8"/>} color="text-green-400"/>
                  <MetricCard title="Mão de Obra + Fixos" value={formatCurrency(bridgeProjectTotals.labCost)} icon={<UserGroupIcon className="w-8 h-8"/>} color="text-blue-400"/>
                  <MetricCard title="Custo Equipamentos" value={formatCurrency(bridgeProjectTotals.equipCost)} icon={<GraderIcon className="w-8 h-8"/>} color="text-amber-400"/>
                  <div className="relative group cursor-pointer" onClick={() => setIsBridgeReportModalOpen(true)}>
                      <MetricCard title="Custo Total" value={formatCurrency(bridgeProjectTotals.total)} icon={<ChartIcon className="w-8 h-8"/>} color="text-brand-accent"/>
                      {/* Botão flutuante de relatório sobre o card */}
                      <div className="absolute top-2 right-2 bg-brand-light/10 backdrop-blur-sm p-1.5 rounded-full hover:bg-brand-accent/80 transition-all border border-white/20 shadow-lg z-10 group-hover:scale-110">
                          <PrinterIcon className="w-4 h-4 text-white"/>
                      </div>
                      {/* Tooltip */}
                      <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="bg-white text-brand-primary font-bold text-xs px-3 py-1 rounded shadow-lg uppercase tracking-wide">Gerar Relatório</span>
                      </div>
                  </div>
              </div>

              {/* Seção de Diários (Mantida) */}
              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-amber-500">
                  <h3 className="text-lg font-bold text-brand-light mb-4">Últimos Registros de Diário (Projeto Selecionado)</h3>
                  <div className="space-y-3">
                      {selectedProjectLogs.length > 0 ? selectedProjectLogs.slice(0, 3).map(log => (<div key={log.id} className="bg-brand-primary p-4 rounded-lg border border-slate-700">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-brand-accent">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                  <span className="text-[10px] text-brand-muted uppercase font-black">{log.weather}</span>
                              </div>
                              <p className="text-sm text-brand-light italic">"{log.description}"</p>
                          </div>)) : (<div className="text-center py-4 text-brand-muted italic">Nenhum diário registrado para este projeto.</div>)}
                  </div>
              </div>

              {/* Modal de Relatório de Pontes */}
              {selectedBridgeProjectId && currentBridgeProject && (<DashboardBridgeReportModal isOpen={isBridgeReportModalOpen} onClose={() => setIsBridgeReportModalOpen(false)} project={currentBridgeProject} materials={bridgeMaterials.filter(m => m.bridgeProjectId === selectedBridgeProjectId)} employees={bridgeEmployees.filter(e => e.bridgeProjectId === selectedBridgeProjectId)} dailyLogs={dailyLogs.filter(l => l.bridgeProjectId === selectedBridgeProjectId)}/>)}
          </div>)}

      {/* ... (Usina logic same) */}
      {activeTab === 'Usina' && (
        // ... (Usina content same)
        <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard title="Prod. CBUQ Total" value={`${usinaProduction.reduce((a, b) => a + b.netCbuq, 0).toFixed(1)} t`} icon={<FactoryIcon className="w-8 h-8"/>} color="text-orange-400"/>
                  <MetricCard title="Temperatura Média" value={`${avgTemp} °C`} icon={<ThermometerIcon className="w-8 h-8"/>} color="text-red-400"/>
                  <MetricCard title="CAP em Estoque" value={`${(bituStats['CAP']?.balance || 0).toFixed(1)} t`} icon={<CubeIcon className="w-8 h-8"/>} color="text-blue-400"/>
                  <MetricCard title="Horas Trabalhadas" value={`${usinaProduction.reduce((a, b) => a + b.workedHours, 0).toFixed(1)} h`} icon={<ClockIcon className="w-8 h-8"/>} color="text-green-400"/>
              </div>

              {/* 1. Estoque Ligantes (NEW) */}
              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-slate-700">
                  <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2 mb-8"><CubeIcon className="w-6 h-6 text-brand-accent"/> Estoque Ligantes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-4">
                      {Object.entries(bituStats).map(([key, data]) => {
                const d = data;
                return <BituVisualTank3D key={key} label={key} current={d.balance} capacity={usinaTankCapacities?.[key] || 1}/>;
            })}
                  </div>
              </div>

              {/* 2. Histórico Entradas (Ligantes) (NEW) */}
              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                  <h5 className="text-brand-light font-bold mb-4 flex items-center gap-2"><TruckIcon className="w-5 h-5 text-blue-400"/> Histórico Entradas (Ligantes)</h5>
                  <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                      <table className="min-w-full text-sm text-left text-brand-muted">
                          <thead className="bg-slate-800 text-xs uppercase sticky top-0"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">NF</th><th className="px-4 py-3 text-right">Peso (t)</th></tr></thead>
                          <tbody>
                              {sortedBituDeliveries.map((delivery) => (<tr key={delivery.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"><td className="px-4 py-3 whitespace-nowrap">{new Date(delivery.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td className="px-4 py-3 text-brand-light">{delivery.product}</td><td className="px-4 py-3">{delivery.ticketNumber}</td><td className="px-4 py-3 text-right font-bold text-green-400">{delivery.tons.toFixed(2)}</td></tr>))}
                              {sortedBituDeliveries.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center italic">Sem dados.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* 3. Histórico Entradas (Agregados) (NEW) */}
              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-green-500">
                  <h5 className="text-brand-light font-bold mb-4">Histórico Entradas (Agregados)</h5>
                  <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                      <table className="min-w-full table-fixed text-sm text-brand-muted">
                          <colgroup>
                              <col className="w-[24%]" />
                              <col className="w-[38%]" />
                              <col className="w-[20%]" />
                              <col className="w-[18%]" />
                          </colgroup>
                          <thead className="bg-slate-800 text-xs uppercase sticky top-0 z-10">
                              <tr>
                                  <th className="px-4 py-3 text-left">Data</th>
                                  <th className="px-4 py-3 text-left">Produto</th>
                                  <th className="px-4 py-3 text-left">Ticket/NF</th>
                                  <th className="px-4 py-3 text-right">Peso</th>
                              </tr>
                          </thead>
                          <tbody>
                              {sortedUsinaDeliveries.map((delivery) => (
                                  <tr key={delivery.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                                      <td className="px-4 py-3 whitespace-nowrap">{new Date(delivery.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                      <td className="px-4 py-3 text-brand-light">{delivery.product}</td>
                                      <td className="px-4 py-3 text-brand-muted">{delivery.ticketNumber || '-'}</td>
                                      <td className="px-4 py-3 text-right font-bold text-green-400 tabular-nums">{delivery.tons.toFixed(2)}</td>
                                  </tr>
                              ))}
                              {sortedUsinaDeliveries.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center italic">Sem dados.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* 4. Controle Diário de Produção (READ ONLY VIEW) (NEW) */}
              <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-orange-500">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                      <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2">
                          <ClipboardListIcon className="w-6 h-6 text-orange-400"/> 
                          Controle Diário de Produção
                      </h4>
                      <div className="flex items-center gap-2 bg-brand-primary px-3 py-2 rounded-lg border border-slate-700 shadow-inner">
                          <CalendarIcon className="w-4 h-4 text-brand-accent"/>
                          <span className="text-[10px] uppercase font-bold text-brand-muted mr-1">Data Ref:</span>
                          <select value={selectedUsinaDate} onChange={(e) => setSelectedUsinaDate(e.target.value)} className="bg-transparent text-brand-light text-xs font-bold outline-none cursor-pointer min-w-[100px]">
                              {availableUsinaDates.map(date => (<option key={date} value={date} className="bg-brand-secondary text-brand-light">
                                      {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </option>))}
                              {availableUsinaDates.length === 0 && <option value="" disabled>Sem dados</option>}
                          </select>
                      </div>
                  </div>
                  
                  {/* Read-Only Form Layout */}
                  <div className="mb-8 opacity-90">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Viagens View */}
                          <div className="lg:col-span-4 bg-brand-primary p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                              <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-3 flex items-center gap-2"><TruckIcon className="w-4 h-4 text-orange-400"/> Viagens ({new Date(displayUsinaDate + 'T00:00:00').toLocaleDateString('pt-BR')})</h5>
                              <div className="flex-1 overflow-y-auto max-h-[320px] border border-slate-700 rounded bg-brand-secondary">
                                   <table className="w-full text-xs text-brand-muted">
                                       <thead className="bg-slate-700 text-brand-light sticky top-0">
                                           <tr>
                                               <th className="p-2 text-left">Prefixo</th>
                                               <th className="p-2 text-center">Ton</th>
                                               <th className="p-2 text-center">°C</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-700">
                                          {latestLoads.length > 0 ? latestLoads.map(load => (<tr key={load.id}>
                                                  <td className="p-2 text-left">{load.plate}</td>
                                                  <td className="p-2 text-center">{load.tons}</td>
                                                  <td className="p-2 text-center">{load.temperature}°</td>
                                              </tr>)) : (<tr><td colSpan={3} className="p-4 text-center italic">Sem viagens registradas.</td></tr>)}
                                       </tbody>
                                   </table>
                              </div>
                          </div>
                          
                          {/* Produção View */}
                          <div className="lg:col-span-3 bg-brand-primary p-4 rounded-lg border border-slate-700 space-y-3">
                              <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-2">Produção</h5>
                              <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Bruta: {latestProd?.grossCbuq || '-'} t</div>
                              <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Rejeito: {latestProd?.waste || '-'} t</div>
                              <div className="bg-slate-700/50 p-3 rounded text-center border border-slate-600 mt-4"><span className="block text-xs text-brand-muted uppercase">Líquida</span><span className="text-2xl font-bold text-green-400">{latestProd?.netCbuq.toFixed(2) || '0.00'} t</span></div>
                          </div>

                          {/* Consumo View */}
                          <div className="lg:col-span-3 bg-brand-primary p-4 rounded-lg border border-slate-700 space-y-3">
                              <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-2">Consumo</h5>
                              <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">CAP: {latestProd?.capConsumed || '-'} t</div>
                              <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Brita 1: {latestProd?.brita1Consumed || '-'} t</div>
                              <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Brita 0: {latestProd?.brita0Consumed || '-'} t</div>
                              <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Pó: {latestProd?.stoneDustConsumed || '-'} t</div>
                          </div>

                          {/* Horas View */}
                          <div className="lg:col-span-2 bg-brand-primary p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
                               <div className="space-y-3">
                                  <h5 className="text-sm font-bold text-brand-light uppercase border-b border-slate-600 pb-2 mb-2">Horas</h5>
                                  <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Inic: {latestProd?.initialHourMeter || '-'}</div>
                                  <div className="w-full bg-brand-secondary border border-slate-600 text-brand-muted rounded p-2 text-sm">Fin: {latestProd?.finalHourMeter || '-'}</div>
                                  <div className="text-center text-xs text-brand-muted mt-2 border-t border-slate-600 pt-2">Horas Trab.<br /><span className="text-brand-light font-bold text-lg">{latestProd?.workedHours.toFixed(1) || '0.0'} h</span></div>
                               </div>
                          </div>
                      </div>
                  </div>

                  <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                       <table className="min-w-full text-sm text-brand-muted">
                           <thead className="bg-slate-800 text-xs uppercase sticky top-0">
                               <tr>
                                   <th className="px-4 py-3 text-left">Data</th>
                                   <th className="px-4 py-3 text-center">Prod. Líq</th>
                                   <th className="px-4 py-3 text-center">Rejeito</th>
                                   <th className="px-4 py-3 text-center">CAP</th>
                                   <th className="px-4 py-3 text-center">Brita 1</th>
                                   <th className="px-4 py-3 text-center">Brita 0</th>
                                   <th className="px-4 py-3 text-center">Pó</th>
                                   <th className="px-4 py-3 text-center">Horas</th>
                               </tr>
                           </thead>
                           <tbody>
                               {sortedProduction.map(log => (<tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                       <td className="px-4 py-3 whitespace-nowrap text-brand-light text-left">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                       <td className="px-4 py-3 text-green-400 font-bold text-center">{log.netCbuq.toFixed(2)}</td>
                                       <td className="px-4 py-3 text-red-400 text-center">{log.waste.toFixed(2)}</td>
                                       <td className="px-4 py-3 text-center">{log.capConsumed.toFixed(2)}</td>
                                       <td className="px-4 py-3 text-center">{log.brita1Consumed.toFixed(2)}</td>
                                       <td className="px-4 py-3 text-center">{log.brita0Consumed.toFixed(2)}</td>
                                       <td className="px-4 py-3 text-center">{log.stoneDustConsumed.toFixed(2)}</td>
                                       <td className="px-4 py-3 text-center">{log.workedHours.toFixed(1)}</td>
                                   </tr>))}
                           </tbody>
                       </table>
                  </div>
              </div>
          </div>)}
    </div>);
};
export default DashboardView;
