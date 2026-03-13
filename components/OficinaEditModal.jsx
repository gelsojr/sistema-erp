import React, { useState, useEffect } from 'react';
import { OficinaSituation, Responsavel } from '../types';
const OficinaEditModal = ({ isOpen, onClose, machine, onSave }) => {
    const [formData, setFormData] = useState({});
    useEffect(() => {
        if (machine) {
            setFormData({
                paralisacaoMotivo: machine.paralisacaoMotivo || '',
                situation: machine.situation,
                releaseForecastDate: machine.releaseForecastDate || '',
                responsavel: machine.responsavel,
            });
        }
        else {
            setFormData({}); // Reset when no machine
        }
    }, [machine]);
    if (!isOpen || !machine)
        return null;
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value || undefined }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(machine.id, formData);
    };
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={handleOverlayClick} aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-lg m-4">
        <h2 className="text-xl font-bold text-brand-light mb-2">Editar Detalhes da Oficina</h2>
        <p className="text-brand-muted mb-4">Máquina: <span className="font-semibold text-brand-light">{machine.prefix} - {machine.name} {machine.model}</span></p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="paralisacaoMotivo" className="block text-sm font-medium text-brand-muted mb-1">Motivo da Paralisação</label>
            <textarea id="paralisacaoMotivo" name="paralisacaoMotivo" value={formData.paralisacaoMotivo} onChange={handleInputChange} rows={3} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="situation" className="block text-sm font-medium text-brand-muted mb-1">Situação</label>
              <select id="situation" name="situation" value={formData.situation || ''} onChange={handleInputChange} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required>
                <option value="" disabled>Selecione...</option>
                {Object.values(OficinaSituation).map(sit => <option key={sit} value={sit}>{sit}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="releaseForecastDate" className="block text-sm font-medium text-brand-muted mb-1">Previsão de Liberação</label>
              <input type="date" id="releaseForecastDate" name="releaseForecastDate" value={formData.releaseForecastDate} onChange={handleInputChange} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
            </div>
          </div>
          
          <div>
            <label htmlFor="responsavel" className="block text-sm font-medium text-brand-muted mb-1">Responsável</label>
            <select id="responsavel" name="responsavel" value={formData.responsavel || ''} onChange={handleInputChange} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required>
              <option value="" disabled>Selecione...</option>
              {Object.values(Responsavel).map(resp => <option key={resp} value={resp}>{resp}</option>)}
            </select>
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
export default OficinaEditModal;
