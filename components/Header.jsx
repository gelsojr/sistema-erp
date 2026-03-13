import React, { useEffect, useRef, useState } from 'react';
import { BellIcon, MenuIcon } from './icons';
import ObraSelector from './ObraSelector';

const Header = ({ toggleSidebar, obras, selectedObraId, onSelectObra, user, notifications, onClearNotifications, onNotificationClick }) => {
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const notificationRef = useRef(null);
    const unreadCount = notifications.filter((n) => !n.read).length;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setNotificationsOpen(false);
            }
        };

        if (isNotificationsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isNotificationsOpen]);

    const toggleNotifications = () => {
        if (!isNotificationsOpen && unreadCount > 0) {
            onClearNotifications();
        }
        setNotificationsOpen(!isNotificationsOpen);
    };

    const canSelectAllObras = user?.allowedObraId === 'all' || !!user?.isAdmin;
    const showObraSelector = canSelectAllObras || user?.role === 'Gerente Geral' || user?.permissions.editDashboard;

    return (
        <header className="bg-brand-secondary shadow-md px-3 sm:px-4 py-3 relative z-30 border-b border-slate-700">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0">
                    <button onClick={toggleSidebar} className="text-brand-muted lg:hidden mr-2 p-1 hover:bg-slate-700 rounded transition-colors">
                        <MenuIcon />
                    </button>
                    <div className="hidden sm:flex flex-col items-start leading-none group cursor-default">
                        <span className="text-brand-logo font-bold uppercase text-[8px] tracking-[0.2em] mb-0.5">Construtora</span>
                        <span className="text-brand-light font-black italic text-xl tracking-tighter group-hover:text-brand-logo transition-colors">PERFIL</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 ml-auto">
                    {user?.isAdmin && (
                        <div className="relative" ref={notificationRef}>
                            <button onClick={toggleNotifications} className="relative focus:outline-none p-2 hover:bg-slate-700 rounded-full transition-colors group">
                                <BellIcon className={`w-6 h-6 group-hover:text-brand-light cursor-pointer transition-colors ${isNotificationsOpen ? 'text-brand-light' : 'text-brand-muted'}`} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                )}
                            </button>

                            {isNotificationsOpen && (
                                <div className="absolute right-0 mt-3 w-[92vw] max-w-sm md:w-96 bg-brand-secondary rounded-lg shadow-xl border border-slate-600 overflow-hidden transform origin-top-right transition-all">
                                    <div className="p-3 bg-brand-primary border-b border-slate-700 flex justify-between items-center">
                                        <h3 className="font-semibold text-brand-light text-sm">Central de Notificações</h3>
                                        <span className="text-xs text-brand-muted">{notifications.length} eventos</span>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-brand-muted text-sm">
                                                Nenhuma notificação recente.
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-slate-700">
                                                {notifications.map((notification) => (
                                                    <li
                                                        key={notification.id}
                                                        onClick={() => {
                                                            onNotificationClick(notification);
                                                            setNotificationsOpen(false);
                                                        }}
                                                        className="p-3 hover:bg-slate-700/50 transition-colors flex items-start gap-3 cursor-pointer"
                                                    >
                                                        <div
                                                            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notification.type === 'alert'
                                                                ? 'bg-red-500'
                                                                : notification.type === 'success'
                                                                    ? 'bg-green-500'
                                                                    : 'bg-blue-500'}`}
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-sm text-brand-light leading-snug">{notification.message}</p>
                                                            <p className="text-xs text-brand-muted mt-1">
                                                                {notification.timestamp.toLocaleDateString('pt-BR')} às {notification.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center space-x-2 sm:space-x-3 bg-brand-primary/50 py-1 pl-1 pr-2 sm:pr-3 rounded-full border border-slate-700 max-w-[220px] sm:max-w-none">
                        <img src={`https://picsum.photos/seed/${user?.username || 'user'}/40/40`} alt="User Avatar" className="w-8 h-8 rounded-full border border-brand-accent" />
                        <div className="hidden md:block min-w-0">
                            <p className="font-bold text-brand-light text-xs leading-none truncate">{user?.name || 'Usuário'}</p>
                            <p className="text-[10px] text-brand-muted uppercase font-semibold mt-1 tracking-wider truncate">{user?.role || 'Função'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {showObraSelector && (
                <div className="mt-3">
                    <ObraSelector
                        obras={obras}
                        selectedObraId={selectedObraId}
                        onSelectObra={onSelectObra}
                        canSelectAll={canSelectAllObras}
                    />
                </div>
            )}
        </header>
    );
};

export default Header;
