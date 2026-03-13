import React, { useState, useMemo } from 'react';
import { FuelIcon, TrashIcon, TruckIcon, HistoryIcon, PlusIcon, CheckCircleIcon, XMarkIcon, ArrowUpIcon, ArrowDownIcon, CubeIcon, CogIcon } from './icons';
import MachineList from './MachineList';
import LubricationModal from './LubricationModal';
const CRITICAL_LEVEL = 3000;
const AbastecimentosView = ({ machines, maintenanceTasks, records, setRecords, dieselDeliveries, setDieselDeliveries, onAddHorimetro, onSelectMachine, onUpdateMachineStatus, onSyncMachineHours }) => {
    // Estado para a capacidade do tanque (padrão 15000, agora editável)
    const [tankCapacity, setTankCapacity] = useState(15000);
    const [showTankSettings, setShowTankSettings] = useState(false);
    const inventoryStats = useMemo(() => {
        const totalIn = dieselDeliveries.reduce((acc, curr) => acc + curr.liters, 0);
        const totalOut = records.reduce((acc, curr) => acc + (parseFloat(curr.diesel) || 0), 0);
        const currentLevel = totalIn - totalOut;
        const percentage = Math.max(0, Math.min(100, (currentLevel / tankCapacity) * 100));
        return { totalIn, totalOut, currentLevel, percentage };
    }, [dieselDeliveries, records, tankCapacity]);
    const todayStr = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date().toISOString().slice(0, 8) + '01';
    const [reportStartDate, setReportStartDate] = useState(firstDayOfMonth);
    const [reportEndDate, setReportEndDate] = useState(todayStr);
    const [filterEquipment, setFilterEquipment] = useState('all');
    const [delDate, setDelDate] = useState(todayStr);
    const [delLiters, setDelLiters] = useState('');
    const [delSupplier, setDelSupplier] = useState('');
    const [delTicket, setDelTicket] = useState('');
    const [delPrice, setDelPrice] = useState('');
    const [showDeliveryForm, setShowDeliveryForm] = useState(false);
    const [isLubricationModalOpen, setLubricationModalOpen] = useState(false);
    const [selectedMachineForLub, setSelectedMachineForLub] = useState(null);
    const [lubricationDataMap, setLubricationDataMap] = useState({});
    const [selectedFichaPlate, setSelectedFichaPlate] = useState(null);
    const [extPlate, setExtPlate] = useState('');
    const [extName, setExtName] = useState('');
    const [extDiesel, setExtDiesel] = useState('');
    const [extObs, setExtObs] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [fuelEntryDate, setFuelEntryDate] = useState(todayStr);
    const [externalEntryDate, setExternalEntryDate] = useState(todayStr);
    const createRecordId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const filteredMachines = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) {
            return machines;
        }
        return machines.filter((machine) => {
            const prefix = String(machine.prefix || '').toLowerCase();
            const name = String(machine.name || '').toLowerCase();
            const model = String(machine.model || '').toLowerCase();
            return prefix.includes(normalized) || name.includes(normalized) || model.includes(normalized);
        });
    }, [machines, searchTerm]);
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const inDateRange = r.date >= reportStartDate && r.date <= reportEndDate;
            const matchesEquipment = filterEquipment === 'all' || r.prefix === filterEquipment;
            return inDateRange && matchesEquipment;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [records, reportStartDate, reportEndDate, filterEquipment]);
    const uniqueEquipment = useMemo(() => {
        const allPrefixes = records.map(r => r.prefix);
        return Array.from(new Set(allPrefixes)).sort();
    }, [records]);
    const handleAddDelivery = (e) => {
        e.preventDefault();
        if (!delLiters || !delSupplier)
            return;
        const liters = parseFloat(delLiters);
        const price = delPrice ? parseFloat(delPrice) : undefined;
        const totalCost = price ? liters * price : undefined;
        const newDel = {
            id: Date.now().toString(),
            date: delDate,
            liters: liters,
            supplier: delSupplier,
            ticketNumber: delTicket,
            pricePerLiter: price,
            totalCost: totalCost
        };
        setDieselDeliveries(prev => [newDel, ...prev]);
        setDelLiters('');
        setDelSupplier('');
        setDelTicket('');
        setDelPrice('');
        setShowDeliveryForm(false);
    };
    const handleOpenLubrication = (machine) => {
        setSelectedMachineForLub(machine);
        setLubricationModalOpen(true);
    };
    const handleSaveLubrication = (data) => {
        if (selectedMachineForLub) {
            setLubricationDataMap(prev => ({ ...prev, [selectedMachineForLub.id]: data }));
            setLubricationModalOpen(false);
            setSelectedMachineForLub(null);
        }
    };
    const handleQuickFuel = (machine, liters, newHours, entryDate) => {
        const hoursToRecord = newHours !== undefined ? newHours : machine.hours;
        const lubData = lubricationDataMap[machine.id];
        let greaseStr = '-';
        let detailsStr = '';
        if (lubData) {
            if (lubData.grease)
                greaseStr = 'Sim (+100g)';
            const detailsParts = [];
            if (lubData.filters.length > 0)
                detailsParts.push(`Filtros: ${lubData.filters.map(f => `${f.quantity}x ${f.name}`).join(', ')}`);
            if (lubData.engineOil) {
                const oilTypeSuffix = lubData.engineOil.type ? ` ${lubData.engineOil.type}` : '';
                const otherOilObs = lubData.engineOil.otherObservation ? ` (${lubData.engineOil.otherObservation})` : '';
                detailsParts.push(`Motor [${lubData.engineOil.action}${oilTypeSuffix}]: ${lubData.engineOil.amount}L${otherOilObs}`);
            }
            detailsStr = detailsParts.join('; ');
            const newMap = { ...lubricationDataMap };
            delete newMap[machine.id];
            setLubricationDataMap(newMap);
        }
        const newRecord = {
            id: createRecordId(),
            date: entryDate || fuelEntryDate || todayStr,
            machineId: machine.id,
            prefix: machine.prefix,
            machineName: machine.name,
            h_km: hoursToRecord.toString(),
            diesel: liters.toString(),
            arla: '0',
            grease: greaseStr,
            details: detailsStr
        };
        // CRITICAL FIX: Use functional update to avoid missing records
        setRecords(prev => [newRecord, ...prev]);
        // SYNC: Update machine total hours in global state if changed
        if (newHours !== undefined && newHours !== machine.hours) {
            onSyncMachineHours(machine.id, newHours);
        }
    };
    const handleExternalFuel = (e) => {
        e.preventDefault();
        if (!extName || !extDiesel)
            return;
        const newRecord = { id: createRecordId(), date: externalEntryDate || todayStr, machineId: 'external', prefix: extPlate || 'AVULSO', machineName: extName, h_km: '-', diesel: extDiesel, arla: '0', grease: '-', details: extObs || undefined };
        setRecords(prev => [newRecord, ...prev]);
        setExtPlate('');
        setExtName('');
        setExtDiesel('');
        setExtObs('');
    };
    const handleDelete = (id) => {
        if (window.confirm('Remover registro?'))
            setRecords(prev => prev.filter(r => r.id !== id));
    };
    const lubStatusMap = Object.keys(lubricationDataMap).reduce((acc, key) => { acc[key] = true; return acc; }, {});
    return (<div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h3 className="text-2xl font-bold text-brand-light flex items-center gap-2"><FuelIcon className="w-8 h-8 text-brand-accent"/> Gestão de Abastecimentos</h3></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-brand-secondary p-6 rounded-lg shadow-lg border border-slate-700 flex flex-col items-center relative">
              <div className="flex justify-between items-center w-full mb-4">
                  <h4 className="text-sm font-bold text-brand-muted uppercase text-center flex-1 ml-6">Nível do Tanque Principal</h4>
                  <button onClick={() => setShowTankSettings(!showTankSettings)} className={`p-1.5 rounded-full transition-colors ${showTankSettings ? 'bg-brand-accent text-brand-primary' : 'text-brand-muted hover:bg-slate-700 hover:text-brand-light'}`} title="Configurar Capacidade">
                      <CogIcon className="w-4 h-4"/>
                  </button>
              </div>

              {showTankSettings && (<div className="w-full mb-4 p-3 bg-brand-primary rounded-lg border border-slate-600 animate-in slide-in-from-top-2">
                      <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Capacidade Total (L)</label>
                      <div className="flex gap-2">
                          <input type="number" value={tankCapacity} onChange={(e) => setTankCapacity(Math.max(1, parseInt(e.target.value) || 0))} className="w-full bg-brand-secondary border border-slate-500 text-brand-light rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-accent"/>
                      </div>
                  </div>)}

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
                      <button onClick={() => setShowDeliveryForm(!showDeliveryForm)} className={`p-2 rounded-full transition-colors ${showDeliveryForm ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                          {showDeliveryForm ? <XMarkIcon className="w-5 h-5"/> : <PlusIcon className="w-5 h-5"/>}
                      </button>
                  </div>
                  {showDeliveryForm && (<form onSubmit={handleAddDelivery} className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 bg-brand-primary p-4 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-2">
                          <div><label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Data</label><input type="date" value={delDate} onChange={e => setDelDate(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:outline-none" required/></div>
                          <div><label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Qtd (L)</label><input type="number" value={delLiters} onChange={e => setDelLiters(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:outline-none" required/></div>
                          <div><label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Preço/L (R$)</label><input type="number" step="0.01" value={delPrice} onChange={e => setDelPrice(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:outline-none" placeholder="0.00"/></div>
                          <div><label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Fornecedor</label><input type="text" value={delSupplier} onChange={e => setDelSupplier(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:outline-none" required/></div>
                          <div className="flex items-end gap-2"><div className="flex-1"><label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">NF</label><input type="text" value={delTicket} onChange={e => setDelTicket(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1.5 text-xs focus:outline-none"/></div><button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-500 transition-colors"><CheckCircleIcon className="w-5 h-5"/></button></div>
                      </form>)}
                  <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
                      <table className="min-w-full text-xs text-left text-brand-muted">
                          <thead className="bg-slate-800 text-brand-light uppercase sticky top-0"><tr><th className="px-4 py-2">Data</th><th className="px-4 py-2">Fornecedor</th><th className="px-4 py-2 text-right">Volume</th><th className="px-4 py-2 text-right">Preço Un.</th><th className="px-4 py-2 text-right">Total (R$)</th><th className="px-4 py-2 text-center">Ações</th></tr></thead>
                          <tbody className="divide-y divide-slate-700">
                              {dieselDeliveries.map(del => (<tr key={del.id} className="hover:bg-slate-700/50">
                                      <td className="px-4 py-2">{new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                      <td className="px-4 py-2">{del.supplier} <span className="text-[10px] opacity-50">{del.ticketNumber}</span></td>
                                      <td className="px-4 py-2 text-right font-bold text-green-400">+{del.liters} L</td>
                                      <td className="px-4 py-2 text-right">{del.pricePerLiter ? `R$ ${del.pricePerLiter.toFixed(2)}` : '-'}</td>
                                      <td className="px-4 py-2 text-right font-mono text-brand-accent">{del.totalCost ? `R$ ${del.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                                      <td className="px-4 py-2 text-center"><button onClick={() => setDieselDeliveries(prev => prev.filter(d => d.id !== del.id))} className="text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4"/></button></td>
                                  </tr>))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </div>

      <div className="space-y-6">
          <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-blue-500">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-brand-light flex items-center gap-2"><TruckIcon className="w-5 h-5 text-blue-400"/> Abastecimento de Frota</h3>
                  <div className="w-full md:w-80">
                      <label className="block text-[10px] font-black text-brand-muted uppercase mb-1 tracking-wider">Buscar por prefixo</label>
                      <input
                          type="text"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Ex: ES-01, CM-12..."
                          className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                      />
                  </div>
                  <div className="w-full md:w-[320px] bg-brand-primary border border-slate-700 rounded-lg px-3 py-2">
                      <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Data dos lançamentos desta tela</label>
                      <input
                          type="date"
                          value={fuelEntryDate}
                          onChange={(e) => setFuelEntryDate(e.target.value || todayStr)}
                          className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-2 text-xs outline-none"
                      />
                      <p className="mt-1 text-[10px] text-brand-muted">
                          Todo registro salvo em "Abastecimento de Frota" usará esta data.
                      </p>
                  </div>
              </div>
              <MachineList machines={filteredMachines} maintenanceTasks={maintenanceTasks} viewMode="abastecimento" onAddHorimetro={onAddHorimetro} onSelectMachine={onSelectMachine} onUpdateMachineStatus={onUpdateMachineStatus} onRegisterFuel={handleQuickFuel} onOpenLubrication={handleOpenLubrication} lubricationStatusMap={lubStatusMap} entryDate={fuelEntryDate}/>
          </div>

          <div className="bg-brand-secondary p-6 rounded-lg shadow-lg border-t-4 border-purple-500">
              <h3 className="text-lg font-semibold text-brand-light mb-4 flex items-center gap-2"><PlusIcon className="w-5 h-5 text-purple-400"/> Equipamento Avulso / Externo</h3>
              <form onSubmit={handleExternalFuel} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <input type="date" value={externalEntryDate} onChange={e => setExternalEntryDate(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-2 focus:ring-1 focus:ring-purple-400 outline-none"/>
                  <input type="text" value={extPlate} onChange={e => setExtPlate(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-2 focus:ring-1 focus:ring-purple-400 outline-none" placeholder="Placa/Identificação"/>
                  <input type="text" value={extName} onChange={e => setExtName(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-2 focus:ring-1 focus:ring-purple-400 outline-none" placeholder="Equipamento *" required/>
                  <input type="number" value={extDiesel} onChange={e => setExtDiesel(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-2 focus:ring-1 focus:ring-purple-400 outline-none" placeholder="Diesel (L) *" required/>
                  <input type="text" value={extObs} onChange={e => setExtObs(e.target.value)} className="bg-brand-primary border border-slate-600 text-brand-light rounded p-2 focus:ring-1 focus:ring-purple-400 outline-none" placeholder="Observação / Detalhes"/>
                  <button type="submit" className="bg-purple-600 text-white font-bold py-2 rounded hover:bg-purple-500 transition-colors">Registrar Avulso</button>
              </form>
          </div>
      </div>

      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-6">
              <h4 className="text-lg font-semibold text-brand-light flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-brand-accent"/> Histórico de Abastecimentos</h4>
              <div className="flex flex-col sm:flex-row items-end gap-3 bg-brand-primary p-3 rounded-xl border border-slate-700 shadow-inner">
                  <div className="w-full sm:w-auto">
                      <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Equipamento</label>
                      <select value={filterEquipment} onChange={e => setFilterEquipment(e.target.value)} className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 py-2 text-xs outline-none w-full sm:w-48 appearance-none">
                          <option value="all">Todos os Equipamentos</option>
                          {uniqueEquipment.map(prefix => (<option key={prefix} value={prefix}>{prefix}</option>))}
                      </select>
                  </div>
                  <div className="w-full sm:w-auto">
                      <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Início</label>
                      <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 py-2 text-xs outline-none w-full sm:w-40"/>
                  </div>
                  <div className="w-full sm:w-auto">
                      <label className="block text-[10px] font-black text-brand-muted uppercase mb-1">Fim</label>
                      <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="bg-brand-secondary border border-slate-600 text-brand-light rounded-lg px-3 py-2 text-xs outline-none w-full sm:w-40"/>
                  </div>
              </div>
          </div>
          
          <div className="overflow-x-auto bg-brand-primary rounded-lg border border-slate-700 max-h-[320px] overflow-y-auto">
              <table className="min-w-full text-sm text-left text-brand-muted">
                  <thead className="bg-slate-800 text-brand-light uppercase sticky top-0 z-10">
                      <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Prefixo</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3 text-right">Diesel (L)</th><th className="px-4 py-3">Observações</th><th className="px-4 py-3 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                      {filteredRecords.map(record => (<tr key={record.id} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">{new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                            <td className="px-4 py-3 font-bold text-brand-accent">{record.prefix}</td>
                            <td className="px-4 py-3">{record.machineName}</td>
                            <td className="px-4 py-3 text-right font-bold text-blue-400">{record.diesel}</td>
                            <td className="px-4 py-3 text-brand-muted text-xs">{record.details || '-'}</td>
                            <td className="px-4 py-3 text-center"><button onClick={() => handleDelete(record.id)} className="text-red-500 hover:text-red-300"><TrashIcon className="w-4 h-4"/></button></td>
                        </tr>))}
                      {filteredRecords.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center italic text-brand-muted">Nenhum registro encontrado para os filtros aplicados.</td></tr>}
                  </tbody>
              </table>
          </div>
      </div>
      <LubricationModal isOpen={isLubricationModalOpen} onClose={() => setLubricationModalOpen(false)} machine={selectedMachineForLub} onSave={handleSaveLubrication} initialData={selectedMachineForLub ? lubricationDataMap[selectedMachineForLub.id] : undefined}/>
    </div>);
};
export default AbastecimentosView;

