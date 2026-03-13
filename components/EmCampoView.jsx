import React, { useMemo, useState } from 'react';
import MachineList from './MachineList';

const EmCampoView = ({
  machines,
  maintenanceTasks,
  onAddHorimetro,
  onSelectMachine,
  onAddMachineToDashboard,
  onRemoveMachineFromDashboard,
  onUpdateMachineStatus,
  availableMachinesToAdd,
  dashboardMachineIds
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMachines = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return machines;

    return machines.filter((machine) => {
      const prefix = String(machine.prefix || '').toLowerCase();
      const name = String(machine.name || '').toLowerCase();
      const model = String(machine.model || '').toLowerCase();
      return (
        prefix.includes(normalized) ||
        name.includes(normalized) ||
        model.includes(normalized)
      );
    });
  }, [machines, searchTerm]);

  return (
    <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-brand-light">Visão Geral dos Equipamentos</h3>
        <div className="w-full md:w-80">
          <label className="block text-[10px] font-black text-brand-muted uppercase mb-1 tracking-wider">
            Buscar por prefixo
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ex: ES-01, CM-12..."
            className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
        </div>
      </div>

      <MachineList
        machines={filteredMachines}
        maintenanceTasks={maintenanceTasks}
        viewMode="em_campo"
        availableMachinesToAdd={availableMachinesToAdd}
        onAddHorimetro={onAddHorimetro}
        onSelectMachine={onSelectMachine}
        onAddMachineToDashboard={onAddMachineToDashboard}
        onRemoveMachineFromDashboard={onRemoveMachineFromDashboard}
        onUpdateMachineStatus={onUpdateMachineStatus}
        dashboardMachineIds={dashboardMachineIds}
      />
    </div>
  );
};

export default EmCampoView;
