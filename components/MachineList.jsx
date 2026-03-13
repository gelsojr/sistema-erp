import React, { useState, useRef, useEffect } from 'react';
import { MachineStatus } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon } from './icons';
import StatusBadge from './StatusBadge';
const MachineList = ({ machines, maintenanceTasks = [], availableMachinesToAdd = [], viewMode, readOnly = false, onAddHorimetro, onSelectMachine, onAddMachineToDashboard, onRemoveMachineFromDashboard, onUpdateMachineStatus, onRegisterFuel, onOpenLubrication, lubricationStatusMap = {}, dashboardMachineIds = [], entryDate, }) => {
    const [isAdding, setIsAdding] = useState(false);
    // Floating Status Logic
    const [openStatusPopoverId, setOpenStatusPopoverId] = useState(null);
    const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0 });
    const popoverRef = useRef(null);
    const handleScrollClose = useRef(() => setOpenStatusPopoverId(null));
    const [dieselInputs, setDieselInputs] = useState({});
    const [hourMeterInputs, setHourMeterInputs] = useState({});
    const [lubricationSelections, setLubricationSelections] = useState({});
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
    const handleAddSelectChange = (e) => {
        const machineId = e.target.value;
        if (machineId && onAddMachineToDashboard) {
            onAddMachineToDashboard(machineId);
            setIsAdding(false);
        }
    };
    const handleDieselChange = (id, value) => {
        setDieselInputs(prev => ({ ...prev, [id]: value }));
    };
    const handleHourMeterChange = (id, value) => {
        setHourMeterInputs(prev => ({ ...prev, [id]: value }));
    };
    const handleLubricationSelect = (machine, value) => {
        setLubricationSelections(prev => ({ ...prev, [machine.id]: value }));
        if (value === 'Sim' && onOpenLubrication) {
            onOpenLubrication(machine);
        }
    };
    const handleSaveFuel = (machine) => {
        const liters = parseFloat(dieselInputs[machine.id]);
        const enteredHours = hourMeterInputs[machine.id];
        const hours = enteredHours ? parseFloat(enteredHours) : machine.hours;
        if (liters > 0 && onRegisterFuel) {
            onRegisterFuel(machine, liters, hours, entryDate);
            setDieselInputs(prev => ({ ...prev, [machine.id]: '' }));
            setHourMeterInputs(prev => {
                const newState = { ...prev };
                delete newState[machine.id];
                return newState;
            });
            setLubricationSelections(prev => ({ ...prev, [machine.id]: 'Não' }));
        }
        else {
            alert('Informe uma quantidade válida de diesel.');
        }
    };
    const getNextMaintenanceDate = (machine) => {
        const tasks = maintenanceTasks.filter(t => t.machineId === machine.id);
        if (tasks.length > 0) {
            const sortedTasks = [...tasks].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            return sortedTasks[0].dueDate;
        }
        return machine.nextMaintenance;
    };
    const showBrand = viewMode !== 'em_campo' && viewMode !== 'abastecimento';
    const showNextMaintenance = viewMode !== 'em_campo' && viewMode !== 'abastecimento';
    const isAbastecimentoMode = viewMode === 'abastecimento';
    return (<div className="overflow-x-auto overflow-y-auto relative max-h-[320px] rounded-lg border border-brand-primary/60">
      <table className="min-w-full text-sm text-left text-brand-muted">
        <thead className="bg-brand-primary text-xs uppercase sticky top-0 z-10">
          <tr>
            <th scope="col" className="px-6 py-3 w-28 min-w-[112px]">Prefixo</th>
            <th scope="col" className="px-6 py-3">Máquina</th>
            {showBrand && <th scope="col" className="px-6 py-3 hidden md:table-cell">Marca</th>}
            <th scope="col" className="px-6 py-3">{isAbastecimentoMode ? 'Diesel (L)' : 'Status'}</th>
            <th scope="col" className="px-6 py-3 hidden sm:table-cell">Horímetro Total</th>
            <th scope="col" className="px-6 py-3">{isAbastecimentoMode ? 'Lubrificação' : 'Horas trab. no mês'}</th>
            {showNextMaintenance && <th scope="col" className="px-6 py-3">Próx. Manutenção</th>}
            {!readOnly && <th scope="col" className="px-6 py-3 text-center">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-primary">
          {machines.map(machine => {
            const nextDate = getNextMaintenanceDate(machine);
            const hasLubData = lubricationStatusMap[machine.id];
            const lubSelectValue = lubricationSelections[machine.id] || (hasLubData ? 'Sim' : 'Não');
            return (<tr key={machine.id} className="bg-brand-secondary border-b border-brand-primary hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4 font-black text-brand-accent uppercase font-mono whitespace-nowrap w-28 min-w-[112px]">{machine.prefix}</td>
                <td className="px-6 py-4 font-medium text-brand-light whitespace-nowrap cursor-pointer hover:text-brand-accent transition-colors" onClick={() => onSelectMachine(machine)}>
                    {machine.name} {machine.model}
                </td>
                {showBrand && <td className="px-6 py-4 hidden md:table-cell">{machine.brand}</td>}
                
                <td className="px-6 py-4">
                    {isAbastecimentoMode ? (<div className="flex items-center gap-2">
                            <input type="number" placeholder="0" value={dieselInputs[machine.id] || ''} onChange={(e) => handleDieselChange(machine.id, e.target.value)} className="w-24 bg-brand-primary border border-slate-600 text-brand-light rounded p-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none"/>
                        </div>) : (readOnly ? (<StatusBadge status={machine.status}/>) : (<button onClick={(e) => {
                        // Use toggleStatusPopover for Em Campo to allow direct management
                        toggleStatusPopover(e, machine.id);
                    }} className="w-full focus:outline-none">
                                <StatusBadge status={machine.status}/>
                            </button>))}
                </td>

                <td className="px-6 py-4 hidden sm:table-cell font-mono">
                    {isAbastecimentoMode ? (<input type="number" step="0.1" value={hourMeterInputs[machine.id] ?? machine.hours} onChange={(e) => handleHourMeterChange(machine.id, e.target.value)} className="w-24 bg-brand-primary border border-slate-600 text-brand-light rounded p-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none font-mono"/>) : (machine.hours.toLocaleString('pt-BR'))}
                </td>
                
                <td className="px-6 py-4 font-semibold text-brand-light">
                    {isAbastecimentoMode ? (<select value={lubSelectValue} onChange={(e) => handleLubricationSelect(machine, e.target.value)} className={`bg-brand-primary border ${hasLubData ? 'border-purple-500 text-purple-400 font-bold' : 'border-slate-600 text-brand-light'} rounded p-2 text-sm focus:ring-1 focus:ring-purple-400 outline-none`}>
                            <option value="Não">Não</option>
                            <option value="Sim">Sim {hasLubData ? '(Edit)' : ''}</option>
                        </select>) : (machine.monthlyHours ?? '-')}
                </td>

                {showNextMaintenance && <td className="px-6 py-4">{new Date(nextDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>}
                
                {!readOnly && (<td className="px-6 py-4 flex items-center justify-center gap-2">
                        {isAbastecimentoMode ? (<button onClick={() => handleSaveFuel(machine)} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-500 transition-colors shadow-sm" title="Salvar Abastecimento">
                                <CheckCircleIcon className="w-5 h-5"/>
                            </button>) : (<button onClick={() => onAddHorimetro(machine)} className="bg-brand-accent text-brand-primary p-2 rounded-md hover:brightness-110 transition-all shadow-md active:scale-95" aria-label={`Adicionar horímetro para ${machine.name}`}>
                                <PlusIcon className="w-4 h-4"/>
                            </button>)}
                        {viewMode === 'dashboard' && onRemoveMachineFromDashboard && dashboardMachineIds.includes(machine.id) && (<button onClick={() => onRemoveMachineFromDashboard(machine.id)} className="bg-red-500/20 text-red-400 p-2 rounded-md hover:bg-red-500/40 transition-colors"><TrashIcon className="w-4 h-4"/></button>)}
                    </td>)}
                </tr>);
        })}
          {!readOnly && viewMode === 'dashboard' && onAddMachineToDashboard && (<tr className="bg-brand-secondary">
                    <td colSpan={10} className="px-6 py-4 text-center">
                        {availableMachinesToAdd.length > 0 ? (<button onClick={() => setIsAdding(true)} className="text-brand-accent font-bold hover:text-amber-300 transition-colors uppercase text-xs tracking-widest">+ Adicionar Máquina ao Painel</button>) : (<p className="text-xs text-brand-muted italic font-bold uppercase">Frota Total no Dashboard</p>)}
                    </td>
                </tr>)}
        </tbody>
      </table>

      {/* FLOATING MACHINE STATUS MENU */}
      {openStatusPopoverId && !readOnly && onUpdateMachineStatus && (<div ref={popoverRef} className="fixed z-[100] w-48 max-h-[70vh] overflow-y-auto bg-brand-primary border border-slate-600 rounded-lg shadow-2xl p-1 animate-in zoom-in-95 duration-100" style={{
                top: `${popoverCoords.top}px`,
                left: `${popoverCoords.left}px`,
                transform: 'translateX(-50%)'
            }}>
              <div className="py-1.5 px-3 mb-1 border-b border-slate-700">
                  <p className="text-[9px] font-black text-brand-muted uppercase tracking-widest">Status Equipamento</p>
              </div>
              {Object.values(MachineStatus).map(status => (<button key={status} onClick={() => {
                    onUpdateMachineStatus(openStatusPopoverId, status);
                    setOpenStatusPopoverId(null);
                }} className={`w-full text-left px-3 py-2.5 text-[10px] font-black uppercase rounded-md transition-all flex items-center justify-between group ${machines.find(m => m.id === openStatusPopoverId)?.status === status
                    ? 'bg-brand-accent text-brand-primary shadow-lg'
                    : 'text-brand-muted hover:bg-slate-700 hover:text-brand-light'}`}>
                      {status}
                      {machines.find(m => m.id === openStatusPopoverId)?.status === status && <CheckCircleIcon className="w-3.5 h-3.5"/>}
                  </button>))}
          </div>)}
    </div>);
};
export default MachineList;

