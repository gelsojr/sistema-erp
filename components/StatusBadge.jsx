import React from 'react';
import { MachineStatus } from '../types';
const StatusBadge = ({ status, className }) => {
    const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full inline-block text-center";
    const statusClasses = {
        [MachineStatus.Operating]: "bg-green-500/20 text-green-400",
        [MachineStatus.Maintenance]: "bg-yellow-500/20 text-yellow-400",
        [MachineStatus.Disponível]: "bg-blue-500/20 text-blue-400",
        [MachineStatus.MechanicalProblem]: "bg-red-500/20 text-red-400",
    };
    return <span className={`${baseClasses} ${statusClasses[status]} ${className || ''}`}>{status}</span>;
};
export default StatusBadge;
