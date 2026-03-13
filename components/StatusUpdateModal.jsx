import React from 'react';
import { MachineStatus } from '../types';
const StatusUpdateModal = ({ isOpen, onClose, machine, onUpdateStatus }) => {
    if (!isOpen || !machine)
        return null;
    const handleStatusSelect = (status) => {
        onUpdateStatus(machine.id, status);
    };
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    const statusOptions = [
        MachineStatus.Operating,
        MachineStatus.Disponível,
        MachineStatus.Maintenance,
        MachineStatus.MechanicalProblem
    ];
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={handleOverlayClick} aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-md m-4 animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-brand-light mb-2">Atualizar Status</h2>
        <p className="text-brand-muted mb-4">
          O horímetro da máquina <span className="font-semibold text-brand-light">{machine.prefix} - {machine.name}</span> não foi alterado.
        </p>
        <p className="text-brand-muted mb-6">Por favor, selecione o status atual do equipamento:</p>

        <div className="flex flex-col space-y-3">
          {statusOptions.map(status => (<button key={status} onClick={() => handleStatusSelect(status)} className={`w-full px-4 py-3 text-brand-light font-black uppercase text-xs tracking-widest rounded-md transition-all border border-slate-600 hover:scale-[1.02] active:scale-95 ${status === MachineStatus.Operating
                ? 'bg-green-600 hover:bg-green-500 border-green-500 shadow-lg shadow-green-900/20'
                : 'bg-brand-primary hover:bg-slate-700'}`}>
              {status}
            </button>))}
        </div>
        
        <div className="mt-6 flex justify-end">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-600 text-brand-light font-bold rounded-md hover:bg-slate-500 transition-colors uppercase text-[10px] tracking-widest">
              Cancelar
            </button>
        </div>
      </div>
    </div>);
};
export default StatusUpdateModal;
