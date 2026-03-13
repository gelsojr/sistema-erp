import React, { useState, useEffect, useMemo } from 'react';
import { BridgeIcon, CubeIcon, PlusIcon, TrashIcon, PencilIcon, ChartIcon, UserGroupIcon, BookOpenIcon, SunIcon, CloudIcon, CloudRainIcon, ShoppingCartIcon, GraderIcon, XMarkIcon, PrinterIcon, BuildingIcon, BriefcaseIcon } from './icons';
import MetricCard from './MetricCard';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const getTodayDateKey = () => new Date().toISOString().split('T')[0];
// Variável de controle fora do componente para persistir durante a sessão (troca de abas) mas reiniciar no refresh
let hasAppliedSundayRule = false;
// --- MODAIS INTERNOS ---
const TerminationModal = ({ isOpen, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                    <TrashIcon className="w-5 h-5"/> Confirmar Demissão
                </h3>
                <p className="text-xs text-brand-muted mb-4 leading-relaxed">
                    O funcionário será removido do quadro atual. Se o valor do acerto já foi calculado pelo RH, insira abaixo. Caso contrário, selecione "Confirmar Depois".
                </p>
                
                <label className="block text-xs font-bold text-brand-light uppercase mb-1">Valor do Acerto (R$)</label>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-3 outline-none mb-6 focus:border-red-500 font-bold" placeholder="0.00" autoFocus/>

                <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white text-xs order-3 sm:order-1">Cancelar</button>
                    
                    <button onClick={() => {
            onConfirm(0, true);
            setAmount('');
            onClose();
        }} className="bg-slate-700 text-brand-light px-4 py-2 rounded-lg font-bold uppercase text-[10px] hover:bg-slate-600 border border-slate-600 order-2">
                        Confirmar Depois (Pendente RH)
                    </button>

                    <button onClick={() => {
            if (amount) {
                onConfirm(parseFloat(amount), false);
                setAmount('');
                onClose();
            }
        }} className="bg-red-600 text-white px-6 py-2 rounded-lg font-black uppercase text-xs hover:bg-red-500 shadow-lg order-1 sm:order-3 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!amount}>
                        Confirmar Valor
                    </button>
                </div>
            </div>
        </div>);
};
const SeverancePayModal = ({ isOpen, onClose, employeeName, onSave }) => {
    const [amount, setAmount] = useState('');
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-sm border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200 border-t-4 border-yellow-500">
                <h3 className="text-lg font-bold text-brand-light mb-1 flex items-center gap-2">
                    <BriefcaseIcon className="w-5 h-5 text-yellow-400"/> Lançar Acerto Rescisório
                </h3>
                <p className="text-xs text-brand-muted mb-4">Colaborador: <span className="text-brand-light font-bold">{employeeName}</span></p>
                
                <label className="block text-xs font-bold text-brand-light uppercase mb-1">Valor Final (RH)</label>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-3 outline-none mb-4 focus:ring-1 focus:ring-yellow-500 font-bold text-lg" placeholder="R$ 0,00" autoFocus/>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white text-xs">Cancelar</button>
                    <button onClick={() => {
            if (amount) {
                onSave(parseFloat(amount));
                setAmount('');
                onClose();
            }
        }} className="bg-yellow-500 text-brand-primary px-6 py-2 rounded-lg font-black uppercase text-xs hover:bg-yellow-400 shadow-lg">
                        Salvar Lançamento
                    </button>
                </div>
            </div>
        </div>);
};
const FixedCostsModal = ({ isOpen, onClose, projectId, currentCosts, onSave }) => {
    const [costs, setCosts] = useState([]);
    const [newDesc, setNewDesc] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newType, setNewType] = useState('Mensal');
    useEffect(() => {
        if (isOpen) {
            setCosts(currentCosts.filter(c => c.bridgeProjectId === projectId));
        }
    }, [isOpen, currentCosts, projectId]);
    const handleAdd = () => {
        if (newDesc && newValue) {
            const newItem = {
                id: Date.now().toString(),
                bridgeProjectId: projectId,
                description: newDesc,
                value: parseFloat(newValue),
                type: newType
            };
            setCosts([...costs, newItem]);
            setNewDesc('');
            setNewValue('');
        }
    };
    const handleRemove = (id) => {
        setCosts(costs.filter(c => c.id !== id));
    };
    const handleSave = () => {
        onSave(projectId, costs);
        onClose();
    };
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl">
                <h3 className="text-lg font-bold text-brand-light mb-4 flex items-center gap-2">
                    <BuildingIcon className="w-5 h-5 text-brand-accent"/> Custos Fixos (Alojamento/Admin)
                </h3>
                
                <div className="bg-brand-primary p-4 rounded-lg mb-4 space-y-3 border border-slate-700">
                    <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Descrição (Ex: Internet Starlink)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="col-span-2 w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 text-xs outline-none"/>
                        <input type="number" placeholder="Valor (R$)" value={newValue} onChange={e => setNewValue(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 text-xs outline-none"/>
                        <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 text-xs outline-none">
                            <option value="Mensal">Mensal</option>
                            <option value="Diário">Diário</option>
                            <option value="Único">Único</option>
                        </select>
                    </div>
                    <button onClick={handleAdd} className="w-full bg-green-600 text-white font-bold py-2 rounded text-xs uppercase hover:bg-green-500">Adicionar Custo</button>
                </div>

                <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                    {costs.map(cost => (<div key={cost.id} className="flex justify-between items-center bg-brand-primary p-2 rounded border border-slate-700">
                            <div>
                                <p className="text-xs font-bold text-brand-light">{cost.description}</p>
                                <p className="text-[10px] text-brand-muted uppercase">{cost.type}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-brand-accent font-bold">{formatCurrency(cost.value)}</span>
                                <button onClick={() => handleRemove(cost.id)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-3 h-3"/></button>
                            </div>
                        </div>))}
                    {costs.length === 0 && <p className="text-center text-xs text-brand-muted italic py-4">Nenhum custo fixo registrado.</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-700 pt-4">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white text-xs">Cancelar</button>
                    <button onClick={handleSave} className="bg-brand-accent text-brand-primary px-6 py-2 rounded-lg font-black uppercase text-xs hover:brightness-110">Salvar Alterações</button>
                </div>
            </div>
        </div>);
};
const BridgeReportModal = ({ isOpen, onClose, project, materials, employees, dailyLogs }) => {
    const [startDate, setStartDate] = useState(project.startDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    if (!isOpen)
        return null;
    // Filter Logic
    const filteredMaterials = materials.filter(m => m.receiptDate >= startDate && m.receiptDate <= endDate);
    const filteredLogs = dailyLogs.filter(l => l.date >= startDate && l.date <= endDate);
    // Calculations within Range
    const totalMaterials = filteredMaterials.reduce((acc, m) => acc + m.totalValue, 0);
    const totalEquipment = filteredLogs.reduce((acc, l) => acc + l.equipmentList.reduce((sum, eq) => sum + eq.dailyCost, 0), 0);
    // Prepare Flat List for Equipment Table
    const equipmentDetails = filteredLogs.flatMap(log => log.equipmentList.map(eq => ({
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
        // Regra de alimentação: Só conta se NÃO estiver de baixada ou demitido
        const dailyFood = (emp.breakfastCost || 0) + (emp.lunchCost || 0) + (emp.dinnerCost || 0);
        const foodDays = calculateFoodChargeDays(emp, startDate, endDate);
        const totalCost = (daysInRange * dailySalary) + (foodDays * dailyFood) + (emp.totalAdditionalCost || 0);
        return { ...emp, daysInRange, totalCost };
    }).filter(e => e.daysInRange > 0 || e.totalAdditionalCost > 0);
    const totalLabor = laborDetails.reduce((acc, emp) => acc + emp.totalCost, 0);
    const totalGeneral = totalMaterials + totalLabor + totalEquipment;
    const generatePDF = () => {
        const doc = new jsPDF();
        // Header
        doc.setFontSize(18);
        doc.text("Relatório de Custos - Obra de Arte Especial", 14, 20);
        doc.setFontSize(10);
        doc.text(`Projeto: ${project.name}`, 14, 28);
        doc.text(`Período: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 34);
        // Summary
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
        // Materials Detail
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
        // Equipment Detail
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
                        <table className="w-full text-xs text-left mb-8">
                            <thead className="bg-slate-100 font-bold"><tr><th className="p-2">Data</th><th className="p-2">Material</th><th className="p-2 text-right">Valor Total</th></tr></thead>
                            <tbody>
                                {filteredMaterials.map(m => (<tr key={m.id} className="border-b border-slate-100"><td className="p-2">{new Date(m.receiptDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td className="p-2">{m.material} <span className="text-slate-400">({m.quantity}{m.unit})</span></td><td className="p-2 text-right font-mono">{formatCurrency(m.totalValue)}</td></tr>))}
                                {filteredMaterials.length === 0 && <tr><td colSpan={3} className="p-4 text-center italic text-slate-400">Sem registros no período.</td></tr>}
                            </tbody>
                        </table>

                        <h3 className="text-xs font-black uppercase border-b mb-3 pb-1">Mão de Obra (Proporcional ao Período)</h3>
                        <table className="w-full text-xs text-left mb-8">
                            <thead className="bg-slate-100 font-bold"><tr><th className="p-2">Colaborador</th><th className="p-2 text-center">Dias no Período</th><th className="p-2 text-right">Custo Apróx.</th></tr></thead>
                            <tbody>
                                {laborDetails.map(emp => (<tr key={emp.id} className="border-b border-slate-100"><td className="p-2">{emp.name} <span className="text-slate-400">({emp.role})</span></td><td className="p-2 text-center">{emp.daysInRange}</td><td className="p-2 text-right font-mono">{formatCurrency(emp.totalCost)}</td></tr>))}
                            </tbody>
                        </table>

                        <h3 className="text-xs font-black uppercase border-b mb-3 pb-1 mt-8">Apontamento de Equipamentos</h3>
                        <table className="w-full text-xs text-left mb-8">
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
const ProjectModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
                <h3 className="text-lg font-bold text-brand-light mb-4">Novo Projeto de Ponte</h3>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Projeto..." className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-3 mb-3 outline-none focus:border-brand-accent"/>
                <label className="text-xs text-brand-muted uppercase font-bold mb-1 block">Data de Início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-3 mb-4 outline-none focus:border-brand-accent"/>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white">Cancelar</button>
                    <button onClick={() => { if (name) {
        onSave(name, 'Em Execução', startDate);
        onClose();
        setName('');
    } }} className="bg-brand-accent text-brand-primary px-6 py-2 rounded-lg font-black uppercase text-xs hover:brightness-110">Criar</button>
                </div>
            </div>
        </div>);
};
const EmployeeModal = ({ isOpen, onClose, onSave, projects, workers, initialProjectId }) => {
    const [formData, setFormData] = useState({
        workerId: '',
        name: '',
        role: '',
        salary: '',
        startDate: new Date().toISOString().split('T')[0],
        breakfastCost: '0', lunchCost: '0', dinnerCost: '0',
        selectedProjectId: initialProjectId
    });
    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({ ...prev, selectedProjectId: initialProjectId }));
        }
    }, [isOpen, initialProjectId]);
    if (!isOpen)
        return null;
    const handleWorkerSelect = (e) => {
        const selectedId = e.target.value;
        const worker = workers.find(w => w.id === selectedId);
        if (worker) {
            setFormData(prev => ({
                ...prev,
                workerId: selectedId,
                name: worker.name,
                role: worker.role
            }));
        }
        else {
            setFormData(prev => ({ ...prev, workerId: '', name: '', role: '' }));
        }
    };
    const handleSubmit = () => {
        if (formData.name && formData.role && formData.salary && formData.selectedProjectId) {
            onSave({
                bridgeProjectId: formData.selectedProjectId,
                name: formData.name,
                role: formData.role,
                salary: parseFloat(formData.salary),
                startDate: formData.startDate,
                status: 'Trabalhando',
                daysWorked: 0,
                breakfastCost: parseFloat(formData.breakfastCost) || 0,
                lunchCost: parseFloat(formData.lunchCost) || 0,
                dinnerCost: parseFloat(formData.dinnerCost) || 0
            });
            setFormData({
                workerId: '', name: '', role: '', salary: '',
                startDate: new Date().toISOString().split('T')[0],
                breakfastCost: '0', lunchCost: '0', dinnerCost: '0',
                selectedProjectId: initialProjectId
            });
            onClose();
        }
    };
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-brand-light mb-4">Adicionar Colaborador</h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-brand-muted uppercase font-bold">Projeto Alocado</label>
                        <select value={formData.selectedProjectId} onChange={e => setFormData({ ...formData, selectedProjectId: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none text-xs">
                            <option value="">Selecione um Projeto...</option>
                            {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] text-brand-muted uppercase font-bold">Selecione o Colaborador (Banco de Dados)</label>
                        <select value={formData.workerId} onChange={handleWorkerSelect} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none text-xs">
                            <option value="">Selecione...</option>
                            {workers.map(w => (<option key={w.id} value={w.id}>{w.name} - {w.role}</option>))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-brand-muted uppercase font-bold">Nome (Auto)</label>
                            <input type="text" value={formData.name} readOnly className="w-full bg-slate-800 border border-slate-700 text-brand-muted rounded p-2 outline-none text-xs cursor-not-allowed"/>
                        </div>
                        <div>
                            <label className="text-[10px] text-brand-muted uppercase font-bold">Função (Auto)</label>
                            <input type="text" value={formData.role} readOnly className="w-full bg-slate-800 border border-slate-700 text-brand-muted rounded p-2 outline-none text-xs cursor-not-allowed"/>
                        </div>
                    </div>

                    <input type="number" placeholder="Salário Mensal (R$)" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/>
                    <div>
                        <label className="text-[10px] text-brand-muted uppercase font-bold">Data de Início</label>
                        <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-700">
                        <label className="text-[10px] text-brand-accent uppercase font-bold mb-2 block">Custos Diários de Alimentação (R$)</label>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[9px] text-brand-muted uppercase block">Café</label>
                                <input type="number" value={formData.breakfastCost} onChange={e => setFormData({ ...formData, breakfastCost: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none text-xs"/>
                            </div>
                            <div>
                                <label className="text-[9px] text-brand-muted uppercase block">Almoço</label>
                                <input type="number" value={formData.lunchCost} onChange={e => setFormData({ ...formData, lunchCost: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none text-xs"/>
                            </div>
                            <div>
                                <label className="text-[9px] text-brand-muted uppercase block">Janta</label>
                                <input type="number" value={formData.dinnerCost} onChange={e => setFormData({ ...formData, dinnerCost: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none text-xs"/>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-xs hover:bg-blue-500 uppercase">Salvar</button>
                </div>
            </div>
        </div>);
};
const MaterialModal = ({ isOpen, onClose, onSave, projectId, initialData }) => {
    const [data, setData] = useState({
        id: '',
        receiptDate: new Date().toISOString().split('T')[0],
        supplier: '',
        material: '',
        quantity: '',
        unit: 'un',
        unitPrice: '',
        freightValue: '',
        taxValue: '',
        docNumber: '',
        docType: 'NF'
    });
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (initialData) {
            setData({
                id: initialData.id || '',
                receiptDate: initialData.receiptDate || new Date().toISOString().split('T')[0],
                supplier: initialData.supplier || '',
                material: initialData.material || '',
                quantity: String(initialData.quantity ?? ''),
                unit: initialData.unit || 'un',
                unitPrice: String(initialData.unitPrice ?? ''),
                freightValue: String(initialData.freightValue ?? ''),
                taxValue: String(initialData.taxValue ?? ''),
                docNumber: initialData.docNumber || '',
                docType: initialData.docType || 'NF'
            });
            return;
        }
        setData({
            id: '',
            receiptDate: new Date().toISOString().split('T')[0],
            supplier: '',
            material: '',
            quantity: '',
            unit: 'un',
            unitPrice: '',
            freightValue: '',
            taxValue: '',
            docNumber: '',
            docType: 'NF'
        });
    }, [isOpen, initialData]);
    if (!isOpen)
        return null;
    const computedTotal = (Number(data.quantity || 0) * Number(data.unitPrice || 0)) + Number(data.freightValue || 0) + Number(data.taxValue || 0);
    const handleSubmit = () => {
        if (data.material && data.quantity && data.unitPrice) {
            onSave({
                id: data.id || undefined,
                bridgeProjectId: projectId,
                receiptDate: data.receiptDate,
                emissionDate: data.receiptDate,
                supplier: data.supplier,
                material: data.material,
                quantity: parseFloat(data.quantity),
                unit: data.unit,
                unitPrice: parseFloat(data.unitPrice),
                freightValue: parseFloat(data.freightValue) || 0,
                taxValue: parseFloat(data.taxValue) || 0,
                docNumber: data.docNumber,
                docType: data.docType
            });
            onClose();
        }
    };
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-brand-light mb-4">{initialData ? 'Editar Material' : 'Registrar Entrada de Material'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3"><label className="text-xs text-brand-muted font-bold">Material</label><input type="text" value={data.material} onChange={e => setData({ ...data, material: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/></div>
                    <div className="md:col-span-3"><label className="text-xs text-brand-muted font-bold">Fornecedor</label><input type="text" value={data.supplier} onChange={e => setData({ ...data, supplier: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/></div>
                    <div><label className="text-xs text-brand-muted font-bold">Data Recebimento</label><input type="date" value={data.receiptDate} onChange={e => setData({ ...data, receiptDate: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/></div>
                    <div className="md:col-span-2"><label className="text-xs text-brand-muted font-bold">Nota Fiscal / Doc</label><input type="text" value={data.docNumber} onChange={e => setData({ ...data, docNumber: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/></div>
                    <div><label className="text-xs text-brand-muted font-bold">Quantidade</label><input type="number" step="0.01" value={data.quantity} onChange={e => setData({ ...data, quantity: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/></div>
                    <div><label className="text-xs text-brand-muted font-bold">Unidade</label><select value={data.unit} onChange={e => setData({ ...data, unit: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"><option value="un">Unidade</option><option value="kg">Kg</option><option value="m">Metro</option><option value="m3">m3</option><option value="cx">Caixa</option><option value="saco">Saco</option></select></div>
                    <div><label className="text-xs text-brand-muted font-bold">Valor Unit. (R$)</label><input type="number" step="0.01" value={data.unitPrice} onChange={e => setData({ ...data, unitPrice: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"/></div>
                    <div><label className="text-xs text-brand-muted font-bold">Frete (R$)</label><input type="number" step="0.01" value={data.freightValue} onChange={e => setData({ ...data, freightValue: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="0,00"/></div>
                    <div><label className="text-xs text-brand-muted font-bold">Impostos (R$)</label><input type="number" step="0.01" value={data.taxValue} onChange={e => setData({ ...data, taxValue: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="0,00"/></div>
                </div>
                <div className="mt-4 rounded-lg border border-slate-700 bg-brand-primary p-3">
                    <p className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Total Previsto</p>
                    <p className="text-lg font-black text-teal-400">{formatCurrency(computedTotal)}</p>
                    <p className="text-[10px] text-brand-muted mt-1">Qtd x Valor Unit. + Frete + Impostos</p>
                </div>
                <div className="flex justify-end gap-2 mt-6 border-t border-slate-700 pt-4">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold text-xs hover:bg-teal-500 uppercase">{initialData ? 'Salvar Edição' : 'Salvar Material'}</button>
                </div>
            </div>
        </div>);
};
const DailyLogModal = ({ isOpen, onClose, onSave, projectId, machines, initialData }) => {
    const [logData, setLogData] = useState({ date: new Date().toISOString().split('T')[0], weather: 'Sol', description: '' });
    const [equipList, setEquipList] = useState([]);
    const [selectedMachine, setSelectedMachine] = useState('');
    const [equipCost, setEquipCost] = useState('');
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (initialData) {
            setLogData({
                date: initialData.date || new Date().toISOString().split('T')[0],
                weather: initialData.weather || 'Sol',
                description: initialData.description || ''
            });
            setEquipList((initialData.equipmentList || []).map((item, index) => ({
                id: item.id || `${Date.now()}-${index}`,
                prefix: item.prefix,
                dailyCost: Number(item.dailyCost || 0)
            })));
            return;
        }
        setLogData({ date: new Date().toISOString().split('T')[0], weather: 'Sol', description: '' });
        setEquipList([]);
    }, [isOpen, initialData]);
    if (!isOpen)
        return null;
    const handleAddEquip = () => {
        if (selectedMachine && equipCost) {
            const machine = machines.find(m => m.id === selectedMachine);
            if (machine) {
                setEquipList([...equipList, { id: `${Date.now()}-${Math.random()}`, prefix: machine.prefix, dailyCost: parseFloat(equipCost) }]);
                setSelectedMachine('');
                setEquipCost('');
            }
        }
    };
    const handleRemoveEquip = (id) => {
        setEquipList((prev) => prev.filter((item) => item.id !== id));
    };
    const handleSubmit = () => {
        if (logData.description) {
            onSave({
                id: initialData?.id,
                bridgeProjectId: projectId,
                date: logData.date,
                weather: logData.weather,
                description: logData.description,
                equipmentList: equipList
            });
            onClose();
        }
    };
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-brand-secondary p-6 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-brand-light mb-4">{initialData ? 'Editar Diário de Obra' : 'Novo Diário de Obra'}</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs text-brand-muted font-bold">Data</label>
                        <input type="date" value={logData.date} onChange={e => setLogData({ ...logData, date: e.target.value })} disabled={!!initialData} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none disabled:opacity-60 disabled:cursor-not-allowed"/>
                        {initialData && <p className="text-[10px] text-brand-muted mt-1">Edição liberada somente no próprio dia.</p>}
                    </div>
                    <div><label className="text-xs text-brand-muted font-bold">Clima</label><select value={logData.weather} onChange={e => setLogData({ ...logData, weather: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none"><option value="Sol">Sol</option><option value="Nublado">Nublado</option><option value="Chuva">Chuva</option><option value="Impraticavel">Impraticável</option></select></div>
                </div>
                <div className="mb-4">
                    <label className="text-xs text-brand-muted font-bold">Descricao das Atividades</label>
                    <textarea rows={4} value={logData.description} onChange={e => setLogData({ ...logData, description: e.target.value })} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded p-2 outline-none" placeholder="Descreva o que foi executado hoje..."/>
                </div>
                <div className="bg-brand-primary p-3 rounded-lg border border-slate-700 mb-4">
                    <h4 className="text-xs font-bold text-brand-accent uppercase mb-2">Alocar Equipamento</h4>
                    <div className="flex gap-2 mb-2">
                        <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)} className="flex-1 bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs outline-none">
                            <option value="">Selecione...</option>
                            {machines.map(m => <option key={m.id} value={m.id}>{m.prefix} - {m.name}</option>)}
                        </select>
                        <input type="number" placeholder="Custo Diário (R$)" value={equipCost} onChange={e => setEquipCost(e.target.value)} className="w-32 bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs outline-none"/>
                        <button onClick={handleAddEquip} className="bg-brand-accent text-brand-primary font-bold px-3 rounded text-xs">+</button>
                    </div>
                    {equipList.length > 0 && (<div className="space-y-1 mt-2">
                            {equipList.map((eq) => (<div key={eq.id} className="flex justify-between items-center text-xs bg-slate-700/50 px-2 py-1 rounded">
                                    <span className="text-brand-light">{eq.prefix}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-brand-muted">{formatCurrency(eq.dailyCost)}</span>
                                        <button onClick={() => handleRemoveEquip(eq.id)} className="text-red-400 hover:text-red-300" title="Remover"><TrashIcon className="w-3 h-3"/></button>
                                    </div>
                                </div>))}
                        </div>)}
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-700 pt-4">
                    <button onClick={onClose} className="px-4 py-2 text-brand-muted font-bold hover:text-white">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-amber-600 text-white px-6 py-2 rounded-lg font-bold text-xs hover:bg-amber-500 uppercase">{initialData ? 'Salvar Edição' : 'Salvar Diário'}</button>
                </div>
            </div>
        </div>);
};
// --- COMPONENTE PRINCIPAL ---
const PontesView = ({ projects, materials, withdrawals, employees, fixedCosts, machines, dailyLogs, workers, onAddProject, onDeleteProject, onAddMaterial, onUpdateMaterial, onDeleteMaterial, onAddEmployee, onEditEmployee, onDeleteEmployee, onUpdateEmployeeStatus, onSaveFixedCosts, onSaveDailyLog }) => {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    // States Modais
    const [isProjectModalOpen, setProjectModalOpen] = useState(false);
    const [isMaterialModalOpen, setMaterialModalOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
    const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);
    const [editingDailyLog, setEditingDailyLog] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isFixedCostModalOpen, setIsFixedCostModalOpen] = useState(false);
    // States Demissão e Acerto
    const [terminationModalOpen, setTerminationModalOpen] = useState(false);
    const [employeeToTerminate, setEmployeeToTerminate] = useState(null);
    const [severanceModalOpen, setSeveranceModalOpen] = useState(false);
    const [employeeToPaySeverance, setEmployeeToPaySeverance] = useState(null);
    const [todayDate, setTodayDate] = useState(getTodayDateKey);
    // Efeito para definir "Folga" automaticamente aos domingos
    useEffect(() => {
        const today = new Date();
        const isSunday = today.getDay() === 0; // 0 = Domingo
        const dateKey = today.toISOString().split('T')[0];
        const storageKey = `sunday-auto-folga-${dateKey}`;
        // Verifica se é domingo e se a regra ainda não foi aplicada hoje (para esta sessão/dia)
        if (isSunday && !hasAppliedSundayRule) {
            hasAppliedSundayRule = true;
            // Atualiza todos os funcionários que estão "Trabalhando" para "Folga"
            employees.forEach(emp => {
                if (emp.status === 'Trabalhando') {
                    onUpdateEmployeeStatus(emp.id, 'Folga', 0);
                }
            });
        }
    }, [employees, onUpdateEmployeeStatus]);
    useEffect(() => {
        if (projects.length === 0) {
            if (selectedProjectId) {
                setSelectedProjectId('');
            }
            return;
        }
        const selectedStillExists = projects.some((project) => project.id === selectedProjectId);
        if (!selectedProjectId || !selectedStillExists) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, selectedProjectId]);
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setTodayDate((prev) => {
                const current = getTodayDateKey();
                return prev === current ? prev : current;
            });
        }, 30000);
        return () => window.clearInterval(intervalId);
    }, []);
    useEffect(() => {
        if (!isDailyLogModalOpen || !editingDailyLog) {
            return;
        }
        if (editingDailyLog.date !== todayDate) {
            setIsDailyLogModalOpen(false);
            setEditingDailyLog(null);
            window.alert('O prazo para editar este diário terminou. Apenas o diário do dia pode ser editado.');
        }
    }, [todayDate, isDailyLogModalOpen, editingDailyLog]);
    const currentProject = projects.find(p => p.id === selectedProjectId);
    const projectMaterials = materials.filter(m => m.bridgeProjectId === selectedProjectId);
    const projectEmployees = employees.filter(e => e.bridgeProjectId === selectedProjectId);
    const projectDailyLogs = dailyLogs.filter(log => log.bridgeProjectId === selectedProjectId).sort((a, b) => b.date.localeCompare(a.date));
    const projectFixedCosts = fixedCosts.filter(c => c.bridgeProjectId === selectedProjectId);
    const projectTotals = useMemo(() => {
        const matCost = projectMaterials.reduce((acc, curr) => acc + curr.totalValue, 0);
        const labCost = projectEmployees.reduce((acc, curr) => {
            const days = getDaysWorked(curr.startDate, curr.terminationDate);
            const dailyRate = curr.salary / 30;
            const basic = dailyRate * days;
            const foodDays = calculateFoodChargeDays(curr, curr.startDate, curr.terminationDate || todayDate);
            const food = ((curr.breakfastCost || 0) + (curr.lunchCost || 0) + (curr.dinnerCost || 0)) * foodDays;
            // O custo adicional pode ser rescisão ou outros bônus
            return acc + basic + (curr.totalAdditionalCost || 0) + food;
        }, 0);
        const equipCost = projectDailyLogs.reduce((acc, log) => acc + log.equipmentList.reduce((dayAcc, eq) => dayAcc + (eq.dailyCost || 0), 0), 0);
        const fixedCostTotal = projectFixedCosts.reduce((acc, curr) => acc + curr.value, 0); // Simplified accumulation for dashboard
        return { matCost, labCost: labCost + fixedCostTotal, equipCost, total: matCost + labCost + fixedCostTotal + equipCost };
    }, [projectMaterials, projectEmployees, projectDailyLogs, projectFixedCosts]);
    const handleStatusChange = (id, status) => {
        if (status === 'Demitido') {
            setEmployeeToTerminate(id);
            setTerminationModalOpen(true);
        }
        else if (status === 'De Baixada') {
            // Regra de negocio: aplica no dia da selecao, sem retroativo manual.
            onUpdateEmployeeStatus(id, status, 0, false, todayDate);
        }
        else {
            onUpdateEmployeeStatus(id, status, 0);
        }
    };
    const confirmTermination = (amount, isPending) => {
        if (employeeToTerminate) {
            onUpdateEmployeeStatus(employeeToTerminate, 'Demitido', amount, isPending);
            setEmployeeToTerminate(null);
        }
    };
    const openSeveranceModal = (id, name) => {
        setEmployeeToPaySeverance({ id, name });
        setSeveranceModalOpen(true);
    };
    const saveSeverance = (amount) => {
        if (employeeToPaySeverance) {
            // Atualiza o funcionário removendo a flag pendente e definindo o custo
            onUpdateEmployeeStatus(employeeToPaySeverance.id, 'Demitido', amount, false);
            setEmployeeToPaySeverance(null);
        }
    };
    const handleDeleteSelectedProject = () => {
        if (!currentProject) {
            return;
        }
        if (!window.confirm(`Excluir o projeto "${currentProject.name}"?`)) {
            return;
        }
        onDeleteProject?.(currentProject.id);
        const nextProject = projects.find((project) => project.id !== currentProject.id);
        setSelectedProjectId(nextProject?.id || '');
    };
    const handleOpenEditMaterial = (material) => {
        setEditingMaterial(material);
        setMaterialModalOpen(true);
    };
    const handleOpenEditDailyLog = (log) => {
        if (log.date !== todayDate) {
            window.alert('Só é permitido editar o diário do dia atual.');
            return;
        }
        setEditingDailyLog(log);
        setIsDailyLogModalOpen(true);
    };
    const handleSaveDailyLogWithRules = (payload) => {
        const isEditing = !!payload?.id;
        if (isEditing && payload.date !== todayDate) {
            window.alert('Edição bloqueada: o diário só pode ser editado até 23:59 do próprio dia.');
            return;
        }
        onSaveDailyLog(payload);
    };
    return (<div className="space-y-6">
      {/* Header com Seletor */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-secondary p-4 rounded-xl border border-slate-700 shadow-xl">
        <div className="flex items-center gap-3">
            <div className="bg-brand-accent/20 p-2 rounded-lg"><BridgeIcon className="w-8 h-8 text-brand-accent"/></div>
            <div>
                <h3 className="text-xl font-bold text-brand-light">Gestão de Pontes</h3>
                <p className="text-[10px] text-brand-muted uppercase font-black tracking-widest">Controle de Projetos e Custos</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light font-bold rounded-lg px-4 py-2 outline-none min-w-[240px]">
                <option value="" disabled>Selecione um Projeto...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selectedProjectId && (<button
                    onClick={handleDeleteSelectedProject}
                    className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-500 shadow-lg transition-all flex items-center gap-2 text-xs font-black uppercase"
                    title="Excluir Obra"
                >
                    <TrashIcon className="w-4 h-4"/>
                    Excluir Obra
                </button>)}
            <button onClick={() => setProjectModalOpen(true)} className="bg-brand-accent text-brand-primary p-2 rounded-lg hover:brightness-110 shadow-lg transition-all" title="Novo Projeto"><PlusIcon className="w-5 h-5"/></button>
        </div>
      </div>

      {selectedProjectId ? (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Custos Materiais" value={formatCurrency(projectTotals.matCost)} icon={<CubeIcon className="w-8 h-8"/>} color="text-green-400"/>
                <MetricCard title="Mão de Obra + Fixos" value={formatCurrency(projectTotals.labCost)} icon={<UserGroupIcon className="w-8 h-8"/>} color="text-blue-400"/>
                <MetricCard title="Custo Equipamentos" value={formatCurrency(projectTotals.equipCost)} icon={<GraderIcon className="w-8 h-8"/>} color="text-amber-400"/>
                <div className="relative group cursor-pointer" onClick={() => setIsReportModalOpen(true)}>
                    <MetricCard title="Custo Total" value={formatCurrency(projectTotals.total)} icon={<ChartIcon className="w-8 h-8"/>} color="text-brand-accent"/>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna Equipe & Diário */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-blue-500">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                            <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><UserGroupIcon className="w-6 h-6 text-blue-400"/> Equipe Alocada</h4>
                            <div className="flex gap-2">
                                <button onClick={() => setIsFixedCostModalOpen(true)} className="bg-slate-700 hover:bg-slate-600 text-brand-light px-3 py-2 rounded-lg text-xs font-bold uppercase shadow flex items-center gap-2 border border-slate-500"><BuildingIcon className="w-3 h-3 text-brand-accent"/> Gerir Custos Fixos</button>
                                <button onClick={() => setEmployeeModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase shadow-lg hover:bg-blue-500 transition-all flex items-center gap-2"><PlusIcon className="w-3 h-3"/> Novo Colaborador</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-lg border border-brand-primary/60">
                            <table className="min-w-full text-xs text-left text-brand-muted">
                                <thead className="bg-brand-primary uppercase sticky top-0 z-10"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Função</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
                                <tbody className="divide-y divide-brand-primary">
                                    {projectEmployees.map(emp => {
                // Verifica se é demitido com valor pendente
                const isDismissedPending = emp.status === 'Demitido' && emp.severancePending;
                const isDismissed = emp.status === 'Demitido';
                return (<tr key={emp.id} className={`hover:bg-slate-700/50 ${isDismissedPending ? 'bg-yellow-500/5' : ''}`}>
                                                <td className="px-4 py-3 font-bold text-brand-light flex flex-col">
                                                    {emp.name}
                                                    {isDismissedPending && <span className="text-[10px] font-black text-yellow-500 uppercase mt-0.5 animate-pulse bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 inline-block w-fit">⚠ Aguardando Valor</span>}
                                                </td>
                                                <td className="px-4 py-3">{emp.role}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {isDismissed ? (<span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${isDismissedPending ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                                                            {isDismissedPending ? 'Demitido (Pendente)' : 'Demitido'}
                                                        </span>) : (<select value={emp.status} onChange={(e) => handleStatusChange(emp.id, e.target.value)} className={`px-2 py-1 rounded text-[10px] font-black uppercase outline-none cursor-pointer border border-transparent hover:border-slate-500 transition-colors ${emp.status === 'Trabalhando' ? 'bg-green-500/10 text-green-400' :
                            ['Falta'].includes(emp.status) ? 'bg-red-500/10 text-red-400' :
                                'bg-yellow-500/10 text-yellow-400'}`}>
                                                            <option value="Trabalhando" className="bg-brand-secondary text-brand-light">Trabalhando</option>
                                                            <option value="Falta" className="bg-brand-secondary text-brand-light">Falta</option>
                                                            <option value="Folga" className="bg-brand-secondary text-brand-light">Folga</option>
                                                            <option value="Atestado" className="bg-brand-secondary text-brand-light">Atestado</option>
                                                            <option value="De Baixada" className="bg-brand-secondary text-brand-light">De Baixada</option>
                                                            <option value="Férias" className="bg-brand-secondary text-brand-light">Férias</option>
                                                            <option value="Demitido" className="bg-brand-secondary text-brand-light">Demitido</option>
                                                        </select>)}
                                                </td>
                                                <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                                    {isDismissedPending && (<button onClick={() => openSeveranceModal(emp.id, emp.name)} className="text-yellow-400 hover:text-yellow-900 hover:bg-yellow-400 text-[10px] font-bold uppercase border border-yellow-500/50 px-3 py-1.5 rounded transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(234,179,8,0.2)]" title="Informar valor do acerto">
                                                            <BriefcaseIcon className="w-3 h-3"/> Lançar Acerto
                                                        </button>)}
                                                    <button onClick={() => onDeleteEmployee(emp.id)} className="text-red-500 hover:text-red-400 p-1" title="Remover Histórico"><TrashIcon className="w-4 h-4"/></button>
                                                </td>
                                            </tr>);
            })}
                                    {projectEmployees.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center italic">Nenhum colaborador alocado.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-amber-500">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><BookOpenIcon className="w-6 h-6 text-amber-400"/> Díario de Obras</h4>
                            <button onClick={() => {
                setEditingDailyLog(null);
                setIsDailyLogModalOpen(true);
            }} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase shadow-lg hover:bg-amber-500 transition-all flex items-center gap-2"><PlusIcon className="w-3 h-3"/> Novo Registro</button>
                        </div>
                        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
                            {projectDailyLogs.map(log => (<div key={log.id} className="bg-brand-primary p-5 rounded-xl border border-slate-700 shadow-sm hover:border-amber-500/30 transition-colors">
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center bg-slate-800 px-3 py-1 rounded-lg">
                                                <span className="text-xs font-black text-brand-light">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                                                {log.weather === 'Chuva' ? <CloudRainIcon className="w-4 h-4"/> : log.weather === 'Nublado' ? <CloudIcon className="w-4 h-4"/> : <SunIcon className="w-4 h-4"/>} 
                                                {log.weather}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleOpenEditDailyLog(log)}
                                            disabled={log.date !== todayDate}
                                            className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded border border-slate-600 text-slate-300 hover:text-white hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={log.date === todayDate ? 'Editar diário do dia' : 'Somente diário do dia atual pode ser editado'}
                                        >
                                            <PencilIcon className="w-3 h-3"/> Editar
                                        </button>
                                    </div>
                                    <p className="text-sm text-brand-muted italic leading-relaxed mb-3">"{log.description}"</p>
                                    {log.equipmentList.length > 0 && (<div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50">
                                            {log.equipmentList.map((eq, i) => (<span key={i} className="text-[10px] bg-slate-700 text-brand-light px-2 py-1 rounded flex items-center gap-1">
                                                    <GraderIcon className="w-3 h-3 text-brand-accent"/> {eq.prefix}
                                                </span>))}
                                        </div>)}
                                </div>))}
                            {projectDailyLogs.length === 0 && <div className="text-center py-8 text-brand-muted italic">Nenhum registro de diário.</div>}
                        </div>
                    </div>
                </div>

                {/* Coluna Materiais */}
                <div className="space-y-6">
                    <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-teal-500 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><ShoppingCartIcon className="w-6 h-6 text-teal-400"/> Materiais</h4>
                            <button onClick={() => {
                setEditingMaterial(null);
                setMaterialModalOpen(true);
            }} className="bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-500 shadow-lg transition-all" title="Adicionar Material"><PlusIcon className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 max-h-[320px] pr-1">
                            {projectMaterials.map(m => (<div key={m.id} className="bg-brand-primary p-3 rounded-lg border border-slate-700 group hover:border-teal-500/30 transition-colors space-y-3">
                                    <div className="space-y-1">
                                        <p className="font-bold text-brand-light text-xs break-words leading-tight">{m.material}</p>
                                        <p className="text-[10px] text-brand-muted break-words">{m.supplier}  {new Date(m.receiptDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                        <p className="text-[10px] text-brand-muted">{m.quantity} {m.unit} x {formatCurrency(m.unitPrice)}</p>
                                        <p className="text-[10px] text-brand-muted">Frete: {formatCurrency(m.freightValue || 0)}  Impostos: {formatCurrency(m.taxValue || 0)}</p>
                                    </div>
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="text-[9px] uppercase font-bold text-brand-muted">Total</p>
                                        <p className="font-black text-teal-400 text-sm">{formatCurrency(m.totalValue)}</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => handleOpenEditMaterial(m)} className="w-full text-[10px] font-black uppercase px-2 py-2 rounded border border-blue-500/50 text-blue-400 hover:bg-blue-500/15 transition-colors flex items-center justify-center gap-1" title="Editar Lançamento">
                                            <PencilIcon className="w-3 h-3"/> Editar Lançamento
                                        </button>
                                        <button onClick={() => onDeleteMaterial(m.id)} className="w-full text-[10px] font-black uppercase px-2 py-2 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1" title="Excluir Lançamento">
                                            <TrashIcon className="w-3 h-3"/> Excluir
                                        </button>
                                    </div>
                                </div>))}
                            {projectMaterials.length === 0 && <div className="text-center py-10 text-brand-muted italic bg-brand-primary/20 rounded-lg">Nenhum material lançado.</div>}
                        </div>
                    </div>
                </div>
            </div>
        </>) : (<div className="flex flex-col items-center justify-center py-20 bg-brand-secondary rounded-xl border-2 border-dashed border-slate-700">
            <BridgeIcon className="w-16 h-16 text-brand-muted mb-4 opacity-20"/>
            <p className="text-brand-muted font-bold uppercase tracking-widest">Nenhum projeto de ponte selecionado.</p>
            <button onClick={() => setProjectModalOpen(true)} className="mt-4 bg-brand-accent text-brand-primary px-6 py-2 rounded-lg font-black uppercase text-xs hover:scale-105 transition-transform">Criar Primeiro Projeto</button>
        </div>)}

      {/* Renderização dos Modais */}
      <ProjectModal isOpen={isProjectModalOpen} onClose={() => setProjectModalOpen(false)} onSave={(name, status, start) => onAddProject({ name, status: status, startDate: start })}/>
      <TerminationModal isOpen={terminationModalOpen} onClose={() => setTerminationModalOpen(false)} onConfirm={confirmTermination}/>
      <SeverancePayModal isOpen={severanceModalOpen} onClose={() => setSeveranceModalOpen(false)} employeeName={employeeToPaySeverance?.name || ''} onSave={saveSeverance}/>
      
      {selectedProjectId && currentProject && (<>
            <MaterialModal
                isOpen={isMaterialModalOpen}
                onClose={() => {
                    setMaterialModalOpen(false);
                    setEditingMaterial(null);
                }}
                onSave={(payload) => {
                    if (editingMaterial?.id) {
                        onUpdateMaterial?.(payload);
                        return;
                    }
                    onAddMaterial(payload);
                }}
                projectId={selectedProjectId}
                initialData={editingMaterial}
            />
            <EmployeeModal isOpen={isEmployeeModalOpen} onClose={() => setEmployeeModalOpen(false)} onSave={onAddEmployee} initialProjectId={selectedProjectId} projects={projects} workers={workers}/>
            <DailyLogModal
                isOpen={isDailyLogModalOpen}
                onClose={() => {
                    setIsDailyLogModalOpen(false);
                    setEditingDailyLog(null);
                }}
                onSave={handleSaveDailyLogWithRules}
                projectId={selectedProjectId}
                machines={machines}
                initialData={editingDailyLog}
            />
            <FixedCostsModal isOpen={isFixedCostModalOpen} onClose={() => setIsFixedCostModalOpen(false)} projectId={selectedProjectId} currentCosts={fixedCosts} onSave={onSaveFixedCosts}/>
            
            <BridgeReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} project={currentProject} materials={projectMaterials} employees={projectEmployees} dailyLogs={projectDailyLogs}/>
          </>)}
    </div>);
};
export default PontesView;
