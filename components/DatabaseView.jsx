import React from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon, BuildingIcon } from './icons';
const DatabaseView = ({ machines, obras, workers, onAddMachine, onEditMachine, onDeleteMachine, onAddWorker, onEditWorker, onDeleteWorker, onAddObra, onEditObra, onDeleteObra }) => {
    const obraMap = new Map(obras.map(o => [o.id, o.name]));
    const machineMap = new Map(machines.map(m => [m.id, m]));
    return (<div className="space-y-6">
      
      {/* Obras Management Card */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-brand-light flex items-center gap-2">
            <BuildingIcon className="w-6 h-6 text-brand-accent"/>
            Gestão de Obras (Sites)
          </h3>
          <button onClick={onAddObra} className="bg-brand-accent text-brand-primary font-semibold py-2 px-4 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2">
            <PlusIcon className="w-5 h-5"/>
            Adicionar Obra
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-lg border border-brand-primary/60">
          <table className="min-w-full text-sm text-left text-brand-muted">
            <thead className="bg-brand-primary text-xs uppercase sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3">Nome da Obra</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {obras.map(obra => (<tr key={obra.id} className="bg-brand-secondary border-b border-brand-primary hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 font-medium text-brand-light">{obra.name}</td>
                  <td className="px-6 py-4 flex justify-end items-center gap-2">
                    <button onClick={() => onEditObra(obra)} className="p-2 text-blue-400 hover:text-blue-300" aria-label={`Editar ${obra.name}`}><PencilIcon /></button>
                    <button onClick={() => onDeleteObra(obra.id)} className="p-2 text-red-500 hover:text-red-400" aria-label={`Excluir ${obra.name}`}><TrashIcon /></button>
                  </td>
                </tr>))}
              {obras.length === 0 && (<tr>
                      <td colSpan={2} className="px-6 py-4 text-center text-brand-muted">
                          Nenhuma obra cadastrada.
                      </td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machines Card */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-brand-light">Banco de Dados de Máquinas</h3>
          <button onClick={onAddMachine} className="bg-brand-accent text-brand-primary font-semibold py-2 px-4 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2">
            <PlusIcon className="w-5 h-5"/>
            Adicionar Máquina
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-lg border border-brand-primary/60">
          <table className="min-w-full text-sm text-left text-brand-muted">
            <thead className="bg-brand-primary text-xs uppercase sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3">Prefixo</th>
                <th scope="col" className="px-6 py-3">Máquina</th>
                <th scope="col" className="px-6 py-3">Marca</th>
                <th scope="col" className="px-6 py-3">Obra</th>
                <th scope="col" className="px-6 py-3">Modelo</th>
                <th scope="col" className="px-6 py-3">Placa</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {machines.map(machine => (<tr key={machine.id} className="bg-brand-secondary border-b border-brand-primary hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4">{machine.prefix}</td>
                  <td className="px-6 py-4 font-medium text-brand-light whitespace-nowrap">{machine.name}</td>
                  <td className="px-6 py-4">{machine.brand}</td>
                  <td className="px-6 py-4">{obraMap.get(machine.obraId) || '-'}</td>
                  <td className="px-6 py-4">{machine.model}</td>
                  <td className="px-6 py-4">{machine.plate || '-'}</td>
                  <td className="px-6 py-4 flex justify-end items-center gap-2">
                    <button onClick={() => onEditMachine(machine)} className="p-2 text-blue-400 hover:text-blue-300" aria-label={`Editar ${machine.name}`}><PencilIcon /></button>
                    <button onClick={() => onDeleteMachine(machine.id)} className="p-2 text-red-500 hover:text-red-400" aria-label={`Excluir ${machine.name}`}><TrashIcon /></button>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workers Card */}
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-brand-light flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-brand-accent"/>
            Gestão de Trabalhadores
          </h3>
          <button onClick={onAddWorker} className="bg-brand-accent text-brand-primary font-semibold py-2 px-4 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2">
            <PlusIcon className="w-5 h-5"/>
            Adicionar Trabalhador
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-lg border border-brand-primary/60">
          <table className="min-w-full text-sm text-left text-brand-muted">
            <thead className="bg-brand-primary text-xs uppercase sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3">Nome</th>
                <th scope="col" className="px-6 py-3">Função</th>
                <th scope="col" className="px-6 py-3">Equipamento / Alocação</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(worker => {
            const machine = worker.machineId ? machineMap.get(worker.machineId) : null;
            return (<tr key={worker.id} className="bg-brand-secondary border-b border-brand-primary hover:bg-slate-700 transition-colors">
                      <td className="px-6 py-4 font-medium text-brand-light">{worker.name}</td>
                      <td className="px-6 py-4">{worker.role}</td>
                      <td className="px-6 py-4">
                          {machine ? (<span className="bg-brand-primary px-2 py-1 rounded text-xs font-semibold text-brand-accent">
                                  {machine.prefix} - {machine.name}
                              </span>) : (<span className="text-xs italic bg-slate-600/30 px-2 py-1 rounded">Geral / Obra</span>)}
                      </td>
                      <td className="px-6 py-4 flex justify-end items-center gap-2">
                        <button onClick={() => onEditWorker(worker)} className="p-2 text-blue-400 hover:text-blue-300" aria-label={`Editar ${worker.name}`}><PencilIcon /></button>
                        <button onClick={() => onDeleteWorker(worker.id)} className="p-2 text-red-500 hover:text-red-400" aria-label={`Excluir ${worker.name}`}><TrashIcon /></button>
                      </td>
                    </tr>);
        })}
              {workers.length === 0 && (<tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-brand-muted">
                          Nenhum trabalhador cadastrado.
                      </td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
};
export default DatabaseView;
