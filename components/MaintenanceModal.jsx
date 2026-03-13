import React, { useState, useEffect, useMemo } from 'react';
const MaintenanceModal = ({ isOpen, onClose, machines, onSave }) => {
    const [machineId, setMachineId] = useState('');
    const [task, setTask] = useState('');
    const [dueDate, setDueDate] = useState('');
    // Sort machines by prefix
    const sortedMachines = useMemo(() => {
        return [...machines].sort((a, b) => a.prefix.localeCompare(b.prefix));
    }, [machines]);
    useEffect(() => {
        if (isOpen) {
            if (sortedMachines.length > 0 && !machineId) {
                setMachineId(sortedMachines[0].id);
            }
            const today = new Date().toISOString().split('T')[0];
            setDueDate(today);
        }
        else {
            // Reset form on close to ensure it's fresh next time it opens
            setMachineId('');
            setTask('');
            setDueDate('');
        }
    }, [isOpen, sortedMachines, machineId]);
    if (!isOpen)
        return null;
    const handleSave = (e) => {
        e.preventDefault();
        if (machineId && task && dueDate) {
            onSave({ machineId, task, dueDate });
        }
    };
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={handleOverlayClick} aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <h2 className="text-xl font-bold text-brand-light mb-4">Agendar Manutenção</h2>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="machine" className="block text-sm font-medium text-brand-muted mb-1">
              Prefixo
            </label>
            <select id="machine" value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required>
              {sortedMachines.map(m => (<option key={m.id} value={m.id}>{m.prefix} - {m.name} {m.model}</option>))}
            </select>
          </div>

          <div>
            <label htmlFor="task" className="block text-sm font-medium text-brand-muted mb-1">
              Descrição da Tarefa
            </label>
            <input id="task" type="text" value={task} onChange={(e) => setTask(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" placeholder="Ex: Troca de óleo do motor" required autoFocus/>
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-brand-muted mb-1">
              Data da Manutenção
            </label>
            <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 text-brand-light rounded-md hover:bg-slate-500 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-accent text-brand-primary font-semibold rounded-md hover:bg-amber-300 transition-colors">
              Agendar
            </button>
          </div>
        </form>
      </div>
    </div>);
};
export default MaintenanceModal;
