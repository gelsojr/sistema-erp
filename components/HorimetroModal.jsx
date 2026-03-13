import React, { useState, useEffect } from 'react';
const HorimetroModal = ({ isOpen, onClose, machine, workers = [], onSave }) => {
    const [reading, setReading] = useState('');
    const [observation, setObservation] = useState('');
    const [reportedBy, setReportedBy] = useState('');
    useEffect(() => {
        // Set initial reading value when modal opens for a machine
        if (machine) {
            setReading(machine.hours.toString());
            setObservation('');
            // Auto-fill reportedBy if a worker (operator) is assigned to this machine
            const assignedWorker = workers.find(w => w.machineId === machine.id);
            setReportedBy(assignedWorker ? assignedWorker.name : '');
        }
    }, [machine, workers]);
    if (!isOpen || !machine)
        return null;
    const handleSave = (e) => {
        e.preventDefault();
        // Allow save if either reading changed OR observation is present
        if (reading || observation) {
            onSave(machine.id, reading, observation, reportedBy);
            setReading(''); // Clear after save
            setObservation('');
            setReportedBy('');
        }
    };
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={handleOverlayClick} aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <h2 className="text-xl font-bold text-brand-light mb-2">Adicionar Horímetro / Ocorrência</h2>
        <p className="text-brand-muted mb-4">Máquina: <span className="font-semibold text-brand-light">{machine.prefix} - {machine.name}</span></p>
        
        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label htmlFor="horimetro" className="block text-sm font-medium text-brand-muted mb-1">
              Nova Leitura do Horímetro
            </label>
            <input id="horimetro" type="number" value={reading} onChange={(e) => setReading(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" placeholder="Ex: 4528"/>
          </div>

          <div className="mb-4">
            <label htmlFor="observation" className="block text-sm font-medium text-brand-muted mb-1">
                Observações / Pequenos Reparos
            </label>
            <textarea id="observation" value={observation} onChange={(e) => setObservation(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" placeholder="Ex: Farol queimado, ar condicionado fraco..." rows={3}/>
            <p className="text-xs text-brand-muted mt-1">Use este campo para reportar problemas que não impedem a operação, mas necessitam de atenção da oficina.</p>
          </div>

          {/* New field for Reporter */}
          <div className="mb-4">
             <label htmlFor="reportedBy" className="block text-sm font-medium text-brand-muted mb-1">
                Reportado por
             </label>
             <input id="reportedBy" type="text" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" placeholder="Nome do Operador ou Informante"/>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 text-brand-light rounded-md hover:bg-slate-500 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-accent text-brand-primary font-semibold rounded-md hover:bg-amber-300 transition-colors">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>);
};
export default HorimetroModal;
