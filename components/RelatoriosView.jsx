import React from 'react';
import { MachineStatus } from '../types';
import { PrinterIcon, WrenchIcon } from './icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
// --- NEW WORKING HOURS LOGIC ---
const calculateWorkingHours = (startDateStr, startTimeStr) => {
    if (!startDateStr)
        return 0;
    const start = new Date(`${startDateStr}T${startTimeStr || '00:00'}:00`);
    const end = new Date();
    if (start >= end)
        return 0;
    const getMinutesForDay = (date, lowerBound, upperBound) => {
        const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
        // Working intervals: 07:00-11:00 and 13:00-18:00
        const morningStart = new Date(y, m, d, 7, 0, 0);
        const morningEnd = new Date(y, m, d, 11, 0, 0);
        const afternoonStart = new Date(y, m, d, 13, 0, 0);
        const afternoonEnd = new Date(y, m, d, 18, 0, 0);
        let mins = 0;
        // Morning Overlap
        const mStart = lowerBound > morningStart ? lowerBound : morningStart;
        const mEnd = upperBound < morningEnd ? upperBound : morningEnd;
        if (mStart < mEnd)
            mins += (mEnd.getTime() - mStart.getTime()) / 60000;
        // Afternoon Overlap
        const aStart = lowerBound > afternoonStart ? lowerBound : afternoonStart;
        const aEnd = upperBound < afternoonEnd ? upperBound : afternoonEnd;
        if (aStart < aEnd)
            mins += (aEnd.getTime() - aStart.getTime()) / 60000;
        return mins;
    };
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / oneDay);
    let totalMinutes = 0;
    if (diffDays === 0) {
        totalMinutes = getMinutesForDay(start, start, end);
    }
    else {
        // First day partial
        const firstDayEnd = new Date(start);
        firstDayEnd.setHours(23, 59, 59, 999);
        totalMinutes += getMinutesForDay(start, start, firstDayEnd);
        // Last day partial
        const lastDayStart = new Date(end);
        lastDayStart.setHours(0, 0, 0, 0);
        totalMinutes += getMinutesForDay(end, lastDayStart, end);
        // Full days in between (9 hours per day)
        if (diffDays > 1) {
            totalMinutes += (diffDays - 1) * 9 * 60;
        }
    }
    return totalMinutes / 60;
};
const calculateDaysStopped = (statusChangeDate, lastStatusChangeTime) => {
    const totalHours = calculateWorkingHours(statusChangeDate, lastStatusChangeTime || '00:00');
    return Math.floor(totalHours / 9);
};
const RelatoriosView = ({ machines, maintenanceTasks }) => {
    const getMotivo = (machine, tasks) => {
        if (machine.paralisacaoMotivo)
            return machine.paralisacaoMotivo;
        if (machine.status === MachineStatus.Maintenance) {
            const relevantTask = tasks.find(t => t.machineId === machine.id);
            if (relevantTask)
                return relevantTask.task;
        }
        return machine.status;
    };
    const generatePDF = () => {
        const doc = new jsPDF();
        // Add Title
        doc.setFontSize(18);
        doc.text("Relatório - Pátio da Oficina (Máquinas Paradas)", 14, 22);
        doc.setFontSize(11);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
        // Prepare data for the table
        const tableData = machines.map(machine => {
            return [
                machine.prefix,
                `${machine.name} ${machine.model}`,
                machine.status,
                machine.statusChangeDate ? new Date(machine.statusChangeDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
                calculateDaysStopped(machine.statusChangeDate, machine.lastStatusChangeTime),
                getMotivo(machine, maintenanceTasks),
                machine.situation || '-',
                machine.releaseForecastDate ? new Date(machine.releaseForecastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
                machine.responsavel || '-'
            ];
        });
        // Generate Table
        autoTable(doc, {
            startY: 35,
            head: [['Prefixo', 'Equipamento', 'Status', 'Data', 'Dias (Úteis)', 'Motivo', 'Situação', 'Previsão', 'Responsável']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }, // brand-primary color
            alternateRowStyles: { fillColor: [241, 245, 249] }, // brand-light color
        });
        // Save PDF
        doc.save("relatorio_oficina.pdf");
    };
    return (<div className="space-y-6">
      <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h3 className="text-lg font-semibold text-brand-light flex items-center gap-2">
                    <WrenchIcon className="w-6 h-6 text-yellow-400"/>
                    Relatório de Máquinas em Manutenção
                </h3>
                <p className="text-sm text-brand-muted mt-1">
                    Gere um arquivo PDF com a lista atualizada de todos os equipamentos que se encontram parados no pátio da oficina.
                </p>
            </div>
            <button onClick={generatePDF} className="bg-brand-accent text-brand-primary font-bold py-2 px-4 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-2 shadow-md">
                <PrinterIcon className="w-5 h-5"/>
                Gerar PDF
            </button>
        </div>

        <div className="bg-brand-primary rounded-lg p-4 border border-slate-700">
             <p className="text-brand-muted text-sm mb-2">Pré-visualização dos dados que constarão no relatório:</p>
             <div className="flex gap-4 text-brand-light font-medium">
                 <div className="bg-brand-secondary px-4 py-2 rounded border border-slate-600">
                    Total de Equipamentos: <span className="text-brand-accent">{machines.length}</span>
                 </div>
                 <div className="bg-brand-secondary px-4 py-2 rounded border border-slate-600">
                    Data de Referência: <span className="text-brand-accent">{new Date().toLocaleDateString('pt-BR')}</span>
                 </div>
             </div>
        </div>
      </div>
    </div>);
};
export default RelatoriosView;
