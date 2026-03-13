import React, { useState, useEffect, useMemo, useRef } from 'react';
const OperatorModal = ({ isOpen, onClose, onSave, workerToEdit, machines }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [machineId, setMachineId] = useState('');
    const wasOpenRef = useRef(false);
    // Sort machines for dropdown
    const sortedMachines = useMemo(() => {
        return [...machines].sort((a, b) => a.prefix.localeCompare(b.prefix));
    }, [machines]);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            if (workerToEdit) {
                setName(workerToEdit.name);
                setRole(workerToEdit.role);
                setMachineId(workerToEdit.machineId || '');
            }
            else {
                setName('');
                setRole('');
                setMachineId('');
            }
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, workerToEdit]);
    if (!isOpen)
        return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ name, role, machineId: machineId || undefined }, workerToEdit?.id);
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <h2 className="text-xl font-bold text-brand-light mb-4">
          {workerToEdit ? 'Editar Trabalhador' : 'Adicionar Trabalhador'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-brand-muted mb-1">Nome Completo</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-brand-muted mb-1">Função</label>
            <input type="text" id="role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" placeholder="Ex: Operador, Pedreiro, Servente..." required/>
          </div>

          <div>
            <label htmlFor="machineId" className="block text-sm font-medium text-brand-muted mb-1">Alocação / Equipamento</label>
            <select id="machineId" value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none">
              <option value="">Nenhum (Geral / Ponte / Outros)</option>
              {sortedMachines.map(m => (<option key={m.id} value={m.id}>{m.prefix} - {m.name}</option>))}
            </select>
            <p className="text-xs text-brand-muted mt-1">Selecione o equipamento se for um operador.</p>
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 text-brand-light rounded-md hover:bg-slate-500">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-accent text-brand-primary font-semibold rounded-md hover:bg-amber-300">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>);
};
export default OperatorModal;
