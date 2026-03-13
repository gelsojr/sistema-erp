import React from 'react';
const MetricCard = ({ title, value, icon, color }) => {
    return (<div className="bg-brand-secondary p-4 rounded-lg shadow-lg flex items-center space-x-3 transition-transform transform hover:scale-105 overflow-hidden border border-slate-700/50">
      <div className={`p-2.5 rounded-full bg-slate-800/50 shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-brand-muted font-bold uppercase tracking-wider truncate" title={title}>{title}</p>
        <p className="text-lg lg:text-xl font-black text-brand-light truncate leading-tight" title={value}>{value}</p>
      </div>
    </div>);
};
export default MetricCard;
