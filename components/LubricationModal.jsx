// ... keep imports ...
import React, { useState, useEffect } from 'react';
import { DropIcon } from './icons';
const LubricationModal = ({ isOpen, onClose, machine, onSave, initialData }) => {
    const [grease, setGrease] = useState('Não');
    // Filters State: { "FilterName": { selected: boolean, quantity: number } }
    const [filters, setFilters] = useState({
        'Filtro de Motor': { selected: false, quantity: 1 },
        'Filtro de Combustível': { selected: false, quantity: 1 },
        'Filtro de Transmissão': { selected: false, quantity: 1 },
        'Filtro Hidráulico': { selected: false, quantity: 1 },
        '1º Filtro de Ar': { selected: false, quantity: 1 },
        '2º Filtro de Ar': { selected: false, quantity: 1 },
        'Outro Filtro': { selected: false, quantity: 1 },
    });
    // Oils (Action, Type, Amount)
    const [engineOilAction, setEngineOilAction] = useState(null);
    const [engineOilType, setEngineOilType] = useState('');
    const [engineOilAmount, setEngineOilAmount] = useState('');
    const [engineOilOtherObservation, setEngineOilOtherObservation] = useState('');
    const [hydraulicOilAction, setHydraulicOilAction] = useState(null);
    const [hydraulicOilType, setHydraulicOilType] = useState('');
    const [hydraulicOilAmount, setHydraulicOilAmount] = useState('');
    const [diffOilAction, setDiffOilAction] = useState(null);
    const [diffOilType, setDiffOilType] = useState('');
    const [diffOilAmount, setDiffOilAmount] = useState('');
    const [transOilAction, setTransOilAction] = useState(null);
    const [transOilType, setTransOilType] = useState('');
    const [transOilAmount, setTransOilAmount] = useState('');
    useEffect(() => {
        if (isOpen && initialData) {
            setGrease(initialData.grease ? 'Sim' : 'Não');
            // Reset filters then apply initial data
            const newFilters = { ...filters };
            Object.keys(newFilters).forEach(k => newFilters[k] = { selected: false, quantity: 1 });
            initialData.filters.forEach(f => {
                newFilters[f.name] = { selected: true, quantity: f.quantity };
            });
            setFilters(newFilters);
            if (initialData.engineOil) {
                setEngineOilAction(initialData.engineOil.action);
                setEngineOilType(initialData.engineOil.type);
                setEngineOilAmount(initialData.engineOil.amount.toString());
                setEngineOilOtherObservation(initialData.engineOil.otherObservation || '');
            }
            if (initialData.hydraulicOil) {
                setHydraulicOilAction(initialData.hydraulicOil.action);
                setHydraulicOilType(initialData.hydraulicOil.type);
                setHydraulicOilAmount(initialData.hydraulicOil.amount.toString());
            }
            if (initialData.differentialOil) {
                setDiffOilAction(initialData.differentialOil.action);
                setDiffOilType(initialData.differentialOil.type);
                setDiffOilAmount(initialData.differentialOil.amount.toString());
            }
            if (initialData.transmissionOil) {
                setTransOilAction(initialData.transmissionOil.action);
                setTransOilType(initialData.transmissionOil.type);
                setTransOilAmount(initialData.transmissionOil.amount.toString());
            }
        }
        else if (isOpen) {
            // Reset
            setGrease('Não');
            setFilters(prev => {
                const reset = { ...prev };
                Object.keys(reset).forEach(k => reset[k] = { selected: false, quantity: 1 });
                return reset;
            });
            setEngineOilAction(null);
            setEngineOilType('');
            setEngineOilAmount('');
            setEngineOilOtherObservation('');
            setHydraulicOilAction(null);
            setHydraulicOilType('');
            setHydraulicOilAmount('');
            setDiffOilAction(null);
            setDiffOilType('');
            setDiffOilAmount('');
            setTransOilAction(null);
            setTransOilType('');
            setTransOilAmount('');
        }
    }, [isOpen, initialData]);
    if (!isOpen || !machine)
        return null;
    const handleFilterToggle = (filterName) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: { ...prev[filterName], selected: !prev[filterName].selected }
        }));
    };
    const handleFilterQuantityChange = (filterName, qty) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: { ...prev[filterName], quantity: parseInt(qty) || 1 }
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (engineOilAction === 'Completou' && engineOilType === 'Outro' && !engineOilOtherObservation.trim()) {
            window.alert('Informe a observação do Óleo de Motor quando selecionar "Outro".');
            return;
        }
        const selectedFilters = Object.entries(filters)
            .filter(([, data]) => data.selected)
            .map(([name, data]) => ({ name, quantity: data.quantity }));
        const data = {
            grease: grease === 'Sim',
            filters: selectedFilters,
            engineOil: engineOilAction ? {
                action: engineOilAction,
                type: engineOilType,
                amount: parseFloat(engineOilAmount) || 0,
                otherObservation: engineOilType === 'Outro' ? engineOilOtherObservation.trim() : undefined
            } : undefined,
            hydraulicOil: hydraulicOilAction ? { action: hydraulicOilAction, type: hydraulicOilType, amount: parseFloat(hydraulicOilAmount) || 0 } : undefined,
            differentialOil: diffOilAction ? { action: diffOilAction, type: diffOilType, amount: parseFloat(diffOilAmount) || 0 } : undefined,
            transmissionOil: transOilAction ? { action: transOilAction, type: transOilType, amount: parseFloat(transOilAmount) || 0 } : undefined,
        };
        onSave(data);
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity p-4 overflow-y-auto">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-2xl my-8 border-t-4 border-purple-500">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-brand-light flex items-center gap-2">
                <DropIcon className="w-6 h-6 text-purple-400"/>
                Detalhes de Lubrificação
            </h2>
            <button onClick={onClose} className="text-brand-muted hover:text-brand-light text-2xl">&times;</button>
        </div>
        <p className="text-brand-muted mb-6 text-sm">Equipamento: <span className="font-bold text-brand-light">{machine.prefix} - {machine.name}</span></p>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* GRAXA */}
            <div className="bg-brand-primary p-4 rounded border border-slate-700">
                <label className="block text-sm font-bold text-brand-light mb-2">Utilizou Graxa?</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="grease" value="Sim" checked={grease === 'Sim'} onChange={(e) => setGrease(e.target.value)} className="text-purple-500 focus:ring-purple-500 bg-brand-secondary"/>
                        <span className="text-sm text-brand-light">Sim (+100g)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="grease" value="Não" checked={grease === 'Não'} onChange={(e) => setGrease(e.target.value)} className="text-purple-500 focus:ring-purple-500 bg-brand-secondary"/>
                        <span className="text-sm text-brand-light">Não</span>
                    </label>
                </div>
            </div>

            {/* FILTROS */}
            <div className="bg-brand-primary p-4 rounded border border-slate-700">
                <label className="block text-sm font-bold text-brand-light mb-3">Troca de Filtros</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.keys(filters).map(filter => (<div key={filter} className="flex items-center justify-between bg-brand-secondary p-2 rounded hover:bg-slate-700 transition-colors border border-slate-600">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input type="checkbox" checked={filters[filter].selected} onChange={() => handleFilterToggle(filter)} className="rounded border-slate-500 text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">{filter}</span>
                            </label>
                            {filters[filter].selected && (<div className="flex items-center gap-2 ml-2">
                                    <span className="text-[10px] text-brand-muted uppercase">Qtd:</span>
                                    <input type="number" min="1" value={filters[filter].quantity} onChange={(e) => handleFilterQuantityChange(filter, e.target.value)} className="w-12 bg-brand-primary border border-slate-500 text-brand-light rounded p-1 text-xs text-center focus:ring-1 focus:ring-purple-400 focus:outline-none"/>
                                </div>)}
                        </div>))}
                </div>
            </div>

            {/* OLEOS */}
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-brand-muted uppercase border-b border-slate-700 pb-1">Troca ou Completou Óleo</h4>
                
                {/* Engine Oil */}
                <div className={`p-3 rounded border ${engineOilAction ? 'bg-purple-900/20 border-purple-500/50' : 'bg-brand-primary border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-brand-light">Óleo de Motor</span>
                        <div className="flex gap-3 bg-brand-secondary px-2 py-1 rounded border border-slate-600">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="engineAction" value="Trocou" checked={engineOilAction === 'Trocou'} onChange={() => setEngineOilAction('Trocou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Trocou</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="engineAction" value="Completou" checked={engineOilAction === 'Completou'} onChange={() => setEngineOilAction('Completou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Completou</span>
                            </label>
                            {engineOilAction && (<button type="button" onClick={() => {
                                setEngineOilAction(null);
                                setEngineOilType('');
                                setEngineOilAmount('');
                                setEngineOilOtherObservation('');
                            }} className="text-xs text-red-400 hover:underline ml-1">Limpar</button>)}
                        </div>
                    </div>
                    {engineOilAction && (<div className="grid grid-cols-2 gap-3 mt-2 pl-2">
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Tipo</label>
                                <select value={engineOilType} onChange={(e) => {
                                    const nextType = e.target.value;
                                    setEngineOilType(nextType);
                                    if (nextType !== 'Outro')
                                        setEngineOilOtherObservation('');
                                }} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs">
                                    <option value="">Selecione...</option>
                                    <option value="15W-40">15W-40</option>
                                    <option value="10W-40">10W-40</option>
                                    <option value="10W-30">10W-30</option>
                                    <option value="5W-30">5W-30</option>
                                    <option value="0W-40">0W-40</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Litros</label>
                                <input type="number" step="0.1" value={engineOilAmount} onChange={(e) => setEngineOilAmount(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs" placeholder="0.0"/>
                            </div>
                            {engineOilAction === 'Completou' && engineOilType === 'Outro' && (<div className="col-span-2">
                                    <label className="block text-xs text-brand-muted mb-1">Observação (Outro)</label>
                                    <input type="text" value={engineOilOtherObservation} onChange={(e) => setEngineOilOtherObservation(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs" placeholder="Descreva qual óleo foi utilizado" required/>
                                </div>)}
                        </div>)}
                </div>

                {/* Hydraulic Oil */}
                <div className={`p-3 rounded border ${hydraulicOilAction ? 'bg-purple-900/20 border-purple-500/50' : 'bg-brand-primary border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-brand-light">Óleo Hidráulico</span>
                        <div className="flex gap-3 bg-brand-secondary px-2 py-1 rounded border border-slate-600">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="hydAction" value="Trocou" checked={hydraulicOilAction === 'Trocou'} onChange={() => setHydraulicOilAction('Trocou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Trocou</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="hydAction" value="Completou" checked={hydraulicOilAction === 'Completou'} onChange={() => setHydraulicOilAction('Completou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Completou</span>
                            </label>
                            {hydraulicOilAction && (<button type="button" onClick={() => { setHydraulicOilAction(null); setHydraulicOilType(''); setHydraulicOilAmount(''); }} className="text-xs text-red-400 hover:underline ml-1">Limpar</button>)}
                        </div>
                    </div>
                    {hydraulicOilAction && (<div className="grid grid-cols-2 gap-3 mt-2 pl-2">
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Tipo</label>
                                <select value={hydraulicOilType} onChange={(e) => setHydraulicOilType(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs">
                                    <option value="">Selecione...</option>
                                    <option value="AW 32">AW 32</option>
                                    <option value="AW 46">AW 46</option>
                                    <option value="AW 68">AW 68</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Litros</label>
                                <input type="number" step="0.1" value={hydraulicOilAmount} onChange={(e) => setHydraulicOilAmount(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs" placeholder="0.0"/>
                            </div>
                        </div>)}
                </div>

                {/* Differential Oil */}
                <div className={`p-3 rounded border ${diffOilAction ? 'bg-purple-900/20 border-purple-500/50' : 'bg-brand-primary border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-brand-light">Óleo Diferencial</span>
                        <div className="flex gap-3 bg-brand-secondary px-2 py-1 rounded border border-slate-600">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="diffAction" value="Trocou" checked={diffOilAction === 'Trocou'} onChange={() => setDiffOilAction('Trocou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Trocou</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="diffAction" value="Completou" checked={diffOilAction === 'Completou'} onChange={() => setDiffOilAction('Completou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Completou</span>
                            </label>
                            {diffOilAction && (<button type="button" onClick={() => { setDiffOilAction(null); setDiffOilType(''); setDiffOilAmount(''); }} className="text-xs text-red-400 hover:underline ml-1">Limpar</button>)}
                        </div>
                    </div>
                    {diffOilAction && (<div className="grid grid-cols-2 gap-3 mt-2 pl-2">
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Tipo</label>
                                <select value={diffOilType} onChange={(e) => setDiffOilType(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs">
                                    <option value="">Selecione...</option>
                                    <option value="80W-90">80W-90</option>
                                    <option value="85W-140">85W-140</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Litros</label>
                                <input type="number" step="0.1" value={diffOilAmount} onChange={(e) => setDiffOilAmount(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs" placeholder="0.0"/>
                            </div>
                        </div>)}
                </div>

                {/* Transmission Oil */}
                <div className={`p-3 rounded border ${transOilAction ? 'bg-purple-900/20 border-purple-500/50' : 'bg-brand-primary border-slate-700'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-brand-light">Óleo Transmissão</span>
                        <div className="flex gap-3 bg-brand-secondary px-2 py-1 rounded border border-slate-600">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="transAction" value="Trocou" checked={transOilAction === 'Trocou'} onChange={() => setTransOilAction('Trocou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Trocou</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="transAction" value="Completou" checked={transOilAction === 'Completou'} onChange={() => setTransOilAction('Completou')} className="text-purple-500 focus:ring-purple-500 bg-brand-primary"/>
                                <span className="text-xs text-brand-light">Completou</span>
                            </label>
                            {transOilAction && (<button type="button" onClick={() => { setTransOilAction(null); setTransOilType(''); setTransOilAmount(''); }} className="text-xs text-red-400 hover:underline ml-1">Limpar</button>)}
                        </div>
                    </div>
                    {transOilAction && (<div className="grid grid-cols-2 gap-3 mt-2 pl-2">
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Tipo</label>
                                <input type="text" value={transOilType} onChange={(e) => setTransOilType(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs" placeholder="Ex: ATF..."/>
                            </div>
                            <div>
                                <label className="block text-xs text-brand-muted mb-1">Litros</label>
                                <input type="number" step="0.1" value={transOilAmount} onChange={(e) => setTransOilAmount(e.target.value)} className="w-full bg-brand-secondary border border-slate-600 text-brand-light rounded p-1 text-xs" placeholder="0.0"/>
                            </div>
                        </div>)}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 text-brand-light rounded hover:bg-slate-500 transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-accent text-brand-primary font-bold rounded hover:bg-amber-300 transition-colors">Confirmar Lubrificação</button>
            </div>
        </form>
      </div>
    </div>);
};
export default LubricationModal;
