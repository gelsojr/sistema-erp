import React from 'react';
import { RoadIcon } from './icons';
const ObraSelector = ({ obras, selectedObraId, onSelectObra, canSelectAll = false }) => {
    return (<div className="flex items-center relative w-full sm:w-auto min-w-0">
      <RoadIcon className="w-5 h-5 text-brand-muted absolute left-3 pointer-events-none"/>
      <select value={selectedObraId} onChange={(e) => onSelectObra(e.target.value)} className="w-full sm:w-[260px] lg:w-[340px] pl-10 pr-4 py-2 appearance-none bg-brand-primary border border-slate-600 text-brand-light font-semibold rounded-md focus:ring-2 focus:ring-brand-accent focus:outline-none cursor-pointer truncate" aria-label="Selecionar Obra">
        {canSelectAll && (<option value="all" className="bg-brand-secondary text-brand-light font-medium">Todas as Obras</option>)}
        {obras.map((obra) => (<option key={obra.id} value={obra.id} className="bg-brand-secondary text-brand-light font-medium">
            {obra.name}
          </option>))}
      </select>
    </div>);
};
export default ObraSelector;
