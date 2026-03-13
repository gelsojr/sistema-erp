import React, { useState, useEffect, useRef } from 'react';
const ObraModal = ({ isOpen, onClose, onSave, obraToEdit }) => {
    const [name, setName] = useState('');
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            if (obraToEdit) {
                setName(obraToEdit.name);
            }
            else {
                setName('');
            }
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, obraToEdit]);
    if (!isOpen)
        return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ name }, obraToEdit?.id);
    };
    return (<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" aria-modal="true" role="dialog">
      <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <h2 className="text-xl font-bold text-brand-light mb-4">
          {obraToEdit ? 'Editar Obra' : 'Nova Obra'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-brand-muted mb-1">Nome da Obra</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-brand-primary border border-brand-secondary text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none" placeholder="Ex: Obra 150 - Rodovia Sul" required/>
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
export default ObraModal;
