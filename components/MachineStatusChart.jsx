import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { MachineStatus } from '../types';
const MachineStatusChart = ({ data }) => {
    const statusCounts = data.reduce((acc, machine) => {
        acc[machine.status] = (acc[machine.status] || 0) + 1;
        return acc;
    }, {});
    const chartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    const COLORS = {
        [MachineStatus.Operating]: '#4ADE80', // green-400
        [MachineStatus.Maintenance]: '#FBBF24', // amber-400
        [MachineStatus.Disponível]: '#60A5FA', // blue-400
        [MachineStatus.MechanicalProblem]: '#F87171', // red-400
    };
    return (<div style={{ width: '100%', minWidth: 240, height: 250, minHeight: 220 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
            {chartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={COLORS[entry.name]}/>))}
          </Pie>
          <Tooltip contentStyle={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E8F0',
            borderRadius: '8px',
            color: '#1E293B',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }} itemStyle={{ color: '#1E293B', fontWeight: 500 }} labelStyle={{ color: '#1E293B', fontWeight: 'bold' }}/>
          <Legend iconType="circle" formatter={(value) => <span className="text-brand-muted">{value}</span>}/>
        </PieChart>
      </ResponsiveContainer>
    </div>);
};
export default MachineStatusChart;
