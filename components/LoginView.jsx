import React, { useState } from 'react';
import { LockIcon, UsersIcon } from './icons';

const LoginView = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const result = await onLogin(email, password);
        if (result?.error) {
            setError(result.error);
        }

        setIsSubmitting(false);
    };

    return (<div className="min-h-screen flex items-center justify-center bg-brand-primary p-4 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-800 to-brand-primary">
            <div className="bg-brand-secondary rounded-2xl shadow-2xl p-10 w-full max-w-md border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-logo shadow-[0_0_15px_rgba(122,62,37,0.4)]"></div>
                
                <div className="flex flex-col items-center mb-10">
                    <div className="bg-brand-logo rounded-2xl p-6 shadow-2xl shadow-black/40 mb-6 border border-white/10 flex flex-col items-center">
                        <span className="text-white font-bold tracking-[0.25em] uppercase text-xs mb-1">
                            Construtora
                        </span>
                        <span className="text-white font-black italic tracking-tighter text-5xl leading-none">
                            PERFIL
                        </span>
                    </div>
                    <div className="h-0.5 w-12 bg-brand-logo/30 mt-4 rounded-full"></div>
                    <p className="text-brand-muted text-sm mt-4 uppercase tracking-widest font-bold opacity-80">Gestão de Obras</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5 ml-1">Email</label>
                        <div className="relative group">
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-xl p-4 pl-12 focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all group-hover:border-slate-500" placeholder="Digite seu email" required/>
                            <UsersIcon className="w-5 h-5 text-brand-muted absolute left-4 top-4 pointer-events-none group-focus-within:text-brand-accent transition-colors"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5 ml-1">Senha</label>
                        <div className="relative group">
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-xl p-4 pl-12 focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all group-hover:border-slate-500" placeholder="Digite sua senha" required/>
                            <LockIcon className="w-5 h-5 text-brand-muted absolute left-4 top-4 pointer-events-none group-focus-within:text-brand-accent transition-colors"/>
                        </div>
                    </div>

                    {error && (<div className="text-red-400 text-xs font-semibold text-center bg-red-900/30 p-3 rounded-lg border border-red-900/50 animate-pulse">
                            {error}
                        </div>)}

                    <button type="submit" disabled={isSubmitting} className={`w-full font-black py-4 px-6 rounded-xl transition-all shadow-xl uppercase tracking-widest text-sm ${isSubmitting
                    ? 'bg-slate-500 text-slate-300 cursor-not-allowed'
                    : 'bg-brand-accent text-brand-primary hover:brightness-110 active:scale-[0.98] shadow-brand-accent/20'}`}>
                        {isSubmitting ? 'Entrando...' : 'Acessar Sistema'}
                    </button>
                </form>
                
                <div className="mt-12 text-center text-[10px] text-brand-muted uppercase tracking-widest font-bold opacity-40">
                    © 2025 Construtora Perfil Engenharia LTDA
                </div>
            </div>
        </div>);
};

export default LoginView;
