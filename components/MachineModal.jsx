import React, { useState, useEffect, useRef } from 'react';
const MachineModal = ({ isOpen, onClose, onSave, machineToEdit, obras, selectedObraId }) => {
    const [formData, setFormData] = useState({
        prefix: '',
        name: '',
        brand: '',
        model: '',
        plate: '',
        obraId: selectedObraId,
        hours: 0,
    });
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            if (machineToEdit) {
                setFormData({
                    prefix: machineToEdit.prefix,
                    name: machineToEdit.name,
                    brand: machineToEdit.brand,
                    model: machineToEdit.model,
                    plate: machineToEdit.plate || '',
                    obraId: machineToEdit.obraId,
                    hours: machineToEdit.hours,
                });
            }
            else {
                setFormData({
                    prefix: '',
                    name: '',
                    brand: '',
                    model: '',
                    plate: '',
                    obraId: selectedObraId,
                    hours: 0,
                });
            }
        }
        wasOpenRef.current = isOpen;
    }, [machineToEdit, isOpen, selectedObraId]);
    if (!isOpen)
        return null;
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'hours' ? parseFloat(value) || 0 : value
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData, machineToEdit?.id);
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-lg m-4">
        <h2 className="text-xl font-bold text-brand-light mb-4">
          {machineToEdit ? 'Editar Máquina' : 'Adicionar Nova Máquina'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prefix" className="block text-sm font-medium text-brand-muted mb-1">Prefixo</label>
              <input type="text" id="prefix" name="prefix" value={formData.prefix} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-brand-muted mb-1">Nome da Máquina</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
            </div>
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-brand-muted mb-1">Marca</label>
              <input type="text" id="brand" name="brand" value={formData.brand} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
            </div>
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-brand-muted mb-1">Modelo</label>
              <input type="text" id="model" name="model" value={formData.model} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
            </div>
            <div>
              <label htmlFor="plate" className="block text-sm font-medium text-brand-muted mb-1">Placa</label>
              <input type="text" id="plate" name="plate" value={formData.plate} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"/>
            </div>
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-brand-muted mb-1">Horímetro Inicial</label>
              <input type="number" id="hours" name="hours" step="0.1" value={formData.hours} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required/>
            </div>
            <div className="md:col-span-2">
                <label htmlFor="obraId" className="block text-sm font-medium text-brand-muted mb-1">Obra</label>
                <select id="obraId" name="obraId" value={formData.obraId} onChange={handleChange} className="w-full bg-brand-primary border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" required>
                    {obras.map(obra => (<option key={obra.id} value={obra.id}>{obra.name}</option>))}
                </select>
            </div>
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
export default MachineModal;
