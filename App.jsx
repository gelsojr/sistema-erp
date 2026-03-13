import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import EmCampoView from './components/EmCampoView';
import OficinaView from './components/OficinaView';
import ConfiguracoesView from './components/ConfiguracoesView';
import DatabaseView from './components/DatabaseView';
import LoginView from './components/LoginView';
import MachineDetailView from './components/MachineDetailView';
import PontesView from './components/PontesView';
import UsinaView from './components/UsinaView';
import AbastecimentosView from './components/AbastecimentosView';
import HorimetroModal from './components/HorimetroModal';
import StatusUpdateModal from './components/StatusUpdateModal';
import OficinaEditModal from './components/OficinaEditModal';
import MaintenanceModal from './components/MaintenanceModal';
import MachineModal from './components/MachineModal';
import OperatorModal from './components/OperatorModal';
import ObraModal from './components/ObraModal';
import { MachineStatus } from './types';
import { getSupabaseClient } from './services/supabaseClient';
const DEFAULT_USER_PERMISSIONS = {
    editDashboard: false,
    editOficina: false,
    editCampo: false,
    editAbastecimentos: false,
    editBancoDados: false,
    editConfiguracoes: false,
    viewRelatorios: false,
    viewPontes: false,
    viewUsina: false
};
const APP_PERMISSION_KEYS = Object.keys(DEFAULT_USER_PERMISSIONS);
const ORDERED_VIEWS = ['Dashboard', 'Em Campo', 'Abastecimentos', 'Oficina', 'Pontes', 'Usina', 'Banco de Dados', 'Configuracoes'];
const MAX_ACTIVE_USERS = 25;
const OFFLINE_QUEUE_KEY = 'erp_offline_queue_v1';
const OFFLINE_CACHE_PREFIX = 'erp_cache_v1_';
const NOTIFICATION_SOUND_KEY = 'erp_notification_sound_enabled_v1';
const ACTIVE_VIEW_KEY = 'erp_active_view_v1';
const AUDIT_LOG_TABLE = 'app_activity_logs';
const MAX_ADMIN_NOTIFICATIONS = 200;
const DEFAULT_TANK_CAPACITIES = { CAP: 60, EAI: 30, 'RR-2C': 30, 'RR-1C': 30 };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isBrowser = typeof window !== 'undefined';
const nowIso = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().split('T')[0];
const safeParseJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch (_error) {
        return fallback;
    }
};
const readLocalJson = (key, fallback) => {
    if (!isBrowser)
        return fallback;
    return safeParseJson(window.localStorage.getItem(key), fallback);
};
const writeLocalJson = (key, value) => {
    if (!isBrowser)
        return;
    window.localStorage.setItem(key, JSON.stringify(value));
};
const getCacheKey = (userId) => `${OFFLINE_CACHE_PREFIX}${userId || 'anon'}`;
const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);
const arePermissionsEqual = (left, right) => APP_PERMISSION_KEYS.every((key) => !!left?.[key] === !!right?.[key]);
const createUuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === 'x' ? random : ((random & 0x3) | 0x8);
        return value.toString(16);
    });
};
const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const deriveUsernameFromEmail = (email) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return normalizedEmail;
    }
    return `usuario_${Date.now()}`;
};
const resolveUpdater = (updater, previous) => (typeof updater === 'function' ? updater(previous) : updater);
const normalizeListIds = (list) => (list || []).map((item) => {
    if (item && typeof item === 'object' && 'id' in item && !isUuid(item.id)) {
        return { ...item, id: createUuid() };
    }
    return item;
});
const normalizeDateFromTs = (ts) => {
    if (!ts)
        return '';
    return new Date(ts).toISOString().split('T')[0];
};
const normalizeTimeFromTs = (ts) => {
    if (!ts)
        return '';
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const mapActivityRowToNotification = (row, read = false) => {
    const actorName = row?.actor_name || 'Usuário';
    const actorRole = row?.actor_role || 'Operador';
    return {
        id: row?.id || createUuid(),
        timestamp: new Date(row?.created_at || row?.client_updated_at || nowIso()),
        message: `${actorName} (${actorRole}): ${row?.message || ''}`,
        type: row?.event_type || 'info',
        read,
        actorName,
        actorRole,
        metadata: row?.context || {}
    };
};
const App = () => {
    // ESTADO INICIAL: NULL PARA FORÇAR TELA DE LOGIN
    const [user, setUser] = useState(null);
    const [activeView, setActiveView] = useState(() => readLocalJson(ACTIVE_VIEW_KEY, 'Dashboard') || 'Dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [selectedMachineDetail, setSelectedMachineDetail] = useState(null);
    // DADOS DA FROTA INICIALIZADOS
    const [machines, setMachines] = useState([
        { id: '1', obraId: '1', prefix: 'ES-01', name: 'Escavadeira', brand: 'Caterpillar', model: '320D', status: MachineStatus.Operating, hours: 4500, nextMaintenance: '2026-12-01', readings: [{ date: '2025-01-01', value: 4500, status: MachineStatus.Operating }], stoppageHistory: [], pendingIssues: [], resolvedIssues: [], supplyLogs: [] },
        { id: '2', obraId: '1', prefix: 'CM-05', name: 'Caminhão', brand: 'Mercedes', model: 'Atego', plate: 'ABC-1234', status: MachineStatus.Operating, hours: 125000, nextMaintenance: '2026-11-20', readings: [{ date: '2025-01-01', value: 125000, status: MachineStatus.Operating }], stoppageHistory: [], pendingIssues: [], resolvedIssues: [], supplyLogs: [] },
    ]);
    const [maintenanceTasks, setMaintenanceTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [syncingOfflineQueue, setSyncingOfflineQueue] = useState(false);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersSaving, setUsersSaving] = useState(false);
    const [obras, setObras] = useState([{ id: '1', name: 'Obra 150 - Rodovia Sul' }, { id: '2', name: 'Obra 151 - Ponte Norte' }]);
    const [workers, setWorkers] = useState([{ id: '1', name: 'João Silva', role: 'Operador de Escavadeira', machineId: '1' }]);
    const [selectedObraId, setSelectedObraId] = useState('all');
    const [notifications, setNotifications] = useState([]);
    // ESTADO DE PONTES RECUPERADO COM DADOS DE EXEMPLO PARA O PREVIEW
    const [bridgeProjects, setBridgeProjects] = useState([
        { id: 'bp1', obraId: '1', name: 'Ponte Rio das Pedras - Km 45', status: 'Em Execução', startDate: '2025-01-10' }
    ]);
    const [bridgeMaterials, setBridgeMaterials] = useState([
        { id: 'bm1', bridgeProjectId: 'bp1', receiptDate: '2025-01-12', emissionDate: '2025-01-10', supplier: 'Votorantim', docType: 'NF', docNumber: '4452', material: 'Cimento CP-II', quantity: 150, unit: 'saco', unitPrice: 38, freightValue: 200, totalValue: (150 * 38) + 200 },
        { id: 'bm2', bridgeProjectId: 'bp1', receiptDate: '2025-01-15', emissionDate: '2025-01-14', supplier: 'Açotelas', docType: 'NF', docNumber: '8812', material: 'Aço CA-50 10mm', quantity: 2500, unit: 'kg', unitPrice: 7.5, freightValue: 450, totalValue: (2500 * 7.5) + 450 }
    ]);
    const [bridgeWithdrawals, setBridgeWithdrawals] = useState([]);
    const [bridgeEmployees, setBridgeEmployees] = useState([
        { id: 'be1', bridgeProjectId: 'bp1', name: 'Carlos Santos', role: 'Encarregado', salary: 4500, daysWorked: 15, startDate: '2025-01-10', status: 'Trabalhando', breakfastCost: 10, lunchCost: 25, dinnerCost: 20 },
        { id: 'be2', bridgeProjectId: 'bp1', name: 'Manoel Ferreira', role: 'Carpinteiro', salary: 3200, daysWorked: 15, startDate: '2025-01-10', status: 'Trabalhando', breakfastCost: 10, lunchCost: 25, dinnerCost: 20 }
    ]);
    const [bridgeFixedCosts, setBridgeFixedCosts] = useState([]);
    const [bridgeEvents, setBridgeEvents] = useState([]);
    const [bridgeServices, setBridgeServices] = useState([]);
    const [dailyLogs, setDailyLogs] = useState([
        { id: 'dl1', bridgeProjectId: 'bp1', date: '2025-01-20', weather: 'Sol', description: 'Realizada a armação dos blocos de fundação do eixo 02. Recebimento de materiais.', equipmentList: [{ prefix: 'ES-01', dailyCost: 450 }] }
    ]);
    const [bridgeMaterialRequests, setBridgeMaterialRequests] = useState([]);
    // ESTADO DA USINA
    const [usinaDeliveries, setUsinaDeliveries] = useState([]);
    const [usinaBitu, setUsinaBitu] = useState([]);
    const [usinaProd, setUsinaProd] = useState([]);
    const [usinaLoads, setUsinaLoads] = useState([]);
    const [bituTankCapacities, setBituTankCapacities] = useState({
        'CAP': 60, 'EAI': 30, 'RR-2C': 30, 'RR-1C': 30
    });
    const [fuelRecords, setFuelRecords] = useState([
        { id: '1', obraId: '1', date: '2025-11-12', machineId: '1', prefix: 'ES-01', machineName: 'Escavadeira', h_km: '4520', diesel: '150', arla: '10', grease: 'Sim', details: 'Filtros: 1x Filtro de Motor' },
    ]);
    const [dieselDeliveries, setDieselDeliveries] = useState([
        { id: 'd1', obraId: '1', date: '2025-11-01', liters: 10000, supplier: 'Posto Central', ticketNumber: 'NF-8821', pricePerLiter: 5.89, totalCost: 58900 },
    ]);
    const [horimetroModalOpen, setHorimetroModalOpen] = useState(false);
    const [statusUpdateModalOpen, setStatusUpdateModalOpen] = useState(false);
    const [oficinaEditModalOpen, setOficinaEditModalOpen] = useState(false);
    const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
    // Database Modal States
    const [machineModalOpen, setMachineModalOpen] = useState(false);
    const [obraModalOpen, setObraModalOpen] = useState(false);
    const [workerModalOpen, setWorkerModalOpen] = useState(false);
    const [editingObra, setEditingObra] = useState(null);
    const [editingWorker, setEditingWorker] = useState(null);
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [dashboardMachineIds, setDashboardMachineIds] = useState([]);
    const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(() => readLocalJson(NOTIFICATION_SOUND_KEY, true) !== false);
    const notificationAudioContextRef = useRef(null);
    const canPlayNotificationSoundRef = useRef(false);
    const flushingOfflineQueueRef = useRef(false);
    const pendingSyncAlertCountRef = useRef(0);
    const currentAuthUserIdRef = useRef(null);
    useEffect(() => {
        writeLocalJson(ACTIVE_VIEW_KEY, activeView);
    }, [activeView]);
    useEffect(() => {
        currentAuthUserIdRef.current = user?.id || null;
    }, [user?.id]);
    useEffect(() => {
        writeLocalJson(NOTIFICATION_SOUND_KEY, notificationSoundEnabled);
    }, [notificationSoundEnabled]);
    useEffect(() => {
        if (!isBrowser) {
            return;
        }
        const unlockAudio = () => {
            canPlayNotificationSoundRef.current = true;
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, []);
    const playNotificationSound = useCallback(() => {
        if (!isBrowser || !canPlayNotificationSoundRef.current) {
            return;
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return;
        }
        if (!notificationAudioContextRef.current) {
            notificationAudioContextRef.current = new AudioContextClass();
        }
        const ctx = notificationAudioContextRef.current;
        if (!ctx || ctx.state === 'suspended') {
            void ctx?.resume?.();
        }
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12);
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }, []);
    const logActivityEvent = useCallback(async ({ message, type = 'info', metadata = {} }) => {
        if (!user?.id || !message) {
            return;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return;
        }
        try {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from(AUDIT_LOG_TABLE).insert({
                actor_id: user.id,
                actor_name: user.name || user.username || user.email || 'Usuário',
                actor_role: user.role || 'Operador',
                event_type: type || 'info',
                message,
                context: metadata || {},
                client_updated_at: nowIso()
            });
            if (error) {
                throw error;
            }
        }
        catch (error) {
            console.error('Falha ao gravar log de atividade:', error);
        }
    }, [user?.email, user?.id, user?.name, user?.role, user?.username]);
    const addNotification = (message, type, options) => {
        const now = new Date();
        const dedupeWindowMs = Number(options?.dedupeWindowMs ?? 15000);
        const shouldStoreLocal = !user?.isAdmin || !!options?.localOnly;
        if (shouldStoreLocal) {
            setNotifications(prev => {
                const nowMs = now.getTime();
                const hasRecentDuplicate = prev.some((item) => item.message === message &&
                    item.type === type &&
                    nowMs - new Date(item.timestamp).getTime() < dedupeWindowMs);
                if (hasRecentDuplicate) {
                    return prev;
                }
                return [{
                        id: Date.now().toString(),
                        timestamp: now,
                        message,
                        type,
                        read: false,
                        actorName: user?.name || user?.username || user?.email || 'Usuário',
                        actorRole: user?.role || 'Operador',
                        metadata: options?.metadata || {}
                    }, ...prev];
            });
        }
        if (!options?.skipAudit) {
            void logActivityEvent({
                message,
                type,
                metadata: options?.metadata || {}
            });
        }
        if (!options?.silent && notificationSoundEnabled) {
            playNotificationSound();
        }
    };
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }
        if (!user.isAdmin) {
            setNotifications([]);
        }
    }, [user?.id, user?.isAdmin]);
    useEffect(() => {
        if (!user?.isAdmin) {
            return;
        }
        let isMounted = true;
        let channel = null;
        const loadAdminNotifications = async () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return;
            }
            try {
                const supabase = getSupabaseClient();
                const { data, error } = await supabase
                    .from(AUDIT_LOG_TABLE)
                    .select('id, created_at, actor_name, actor_role, event_type, message, context')
                    .order('created_at', { ascending: false })
                    .limit(MAX_ADMIN_NOTIFICATIONS);
                if (error) {
                    throw error;
                }
                if (!isMounted) {
                    return;
                }
                setNotifications((prev) => {
                    const previousReadMap = new Map(prev.map((item) => [item.id, item.read]));
                    return (data || []).map((row) => mapActivityRowToNotification(row, previousReadMap.get(row.id) === true));
                });
            }
            catch (error) {
                console.error('Falha ao carregar feed global de notificacoes:', error);
            }
        };
        const setupRealtimeFeed = () => {
            try {
                const supabase = getSupabaseClient();
                channel = supabase
                    .channel(`admin-activity-feed-${user.id}`)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: AUDIT_LOG_TABLE }, (payload) => {
                    const item = mapActivityRowToNotification(payload.new, false);
                    setNotifications((prev) => {
                        if (prev.some((entry) => entry.id === item.id)) {
                            return prev;
                        }
                        return [item, ...prev].slice(0, MAX_ADMIN_NOTIFICATIONS);
                    });
                    if (notificationSoundEnabled) {
                        playNotificationSound();
                    }
                })
                    .subscribe();
            }
            catch (error) {
                console.error('Falha ao iniciar realtime das notificacoes:', error);
            }
        };
        void loadAdminNotifications().then(() => {
            if (isMounted) {
                setupRealtimeFeed();
            }
        });
        return () => {
            isMounted = false;
            if (channel) {
                try {
                    const supabase = getSupabaseClient();
                    void supabase.removeChannel(channel);
                }
                catch (_error) {
                    channel?.unsubscribe?.();
                }
            }
        };
    }, [notificationSoundEnabled, playNotificationSound, user?.id, user?.isAdmin]);
    const getOfflineQueue = useCallback(() => readLocalJson(OFFLINE_QUEUE_KEY, []), []);
    const setOfflineQueue = useCallback((queue) => {
        writeLocalJson(OFFLINE_QUEUE_KEY, queue);
    }, []);
    const enqueueOfflineAction = useCallback((action) => {
        const queue = getOfflineQueue();
        queue.push({ ...action, queued_at: nowIso() });
        setOfflineQueue(queue);
    }, [getOfflineQueue, setOfflineQueue]);
    const runDbAction = useCallback(async (supabase, action) => {
        if (action.type === 'upsert') {
            const { error } = await supabase.from(action.table).upsert(action.payload, {
                onConflict: action.onConflict || 'id'
            });
            if (error)
                throw error;
            return;
        }
        if (action.type === 'update') {
            let query = supabase.from(action.table).update(action.payload);
            Object.entries(action.match || {}).forEach(([column, value]) => {
                query = query.eq(column, value);
            });
            Object.entries(action.matchIs || {}).forEach(([column, value]) => {
                query = query.is(column, value);
            });
            const { error } = await query;
            if (error)
                throw error;
            return;
        }
        if (action.type === 'delete') {
            let query = supabase.from(action.table).delete();
            Object.entries(action.match || {}).forEach(([column, value]) => {
                query = query.eq(column, value);
            });
            const { error } = await query;
            if (error)
                throw error;
            return;
        }
        throw new Error(`Ação offline não suportada: ${action.type}`);
    }, []);
    const executeDbAction = useCallback(async (action, options) => {
        const { silentOffline = false } = options || {};
        const online = typeof navigator === 'undefined' ? true : navigator.onLine;
        if (!online) {
            enqueueOfflineAction(action);
            if (!silentOffline) {
                addNotification('Sem internet: alteracao salva localmente e sera sincronizada.', 'info');
            }
            return { queued: true, error: null };
        }
        try {
            const supabase = getSupabaseClient();
            await runDbAction(supabase, action);
            return { queued: false, error: null };
        }
        catch (error) {
            enqueueOfflineAction(action);
            if (!silentOffline) {
                addNotification('Falha de rede: alteracao entrou na fila offline.', 'alert');
            }
            return { queued: true, error };
        }
    }, [enqueueOfflineAction, runDbAction]);
    const saveSnapshotCache = useCallback((userId, snapshot) => {
        writeLocalJson(getCacheKey(userId), snapshot);
    }, []);
    const loadSnapshotCache = useCallback((userId) => readLocalJson(getCacheKey(userId), null), []);
    const loadAuthenticatedUser = useCallback(async (authUser) => {
        if (!authUser) {
            setUser(null);
            setUsers([]);
            setSelectedObraId('all');
            setAuthLoading(false);
            return;
        }
        try {
            const supabase = getSupabaseClient();
            const [{ data: profile }, { data: permissionsRows }] = await Promise.all([
                supabase.from('profiles').select('id, full_name, username, role, allowed_obra_id, is_admin, is_active').eq('id', authUser.id).single(),
                supabase.from('profile_permissions').select('permission_key, allowed').eq('profile_id', authUser.id).eq('allowed', true)
            ]);
            if (profile && profile.is_active === false) {
                await supabase.auth.signOut();
                setUser(null);
                setUsers([]);
                setSelectedObraId('all');
                addNotification('Seu acesso está desativado. Contate o administrador.', 'alert');
                return;
            }
            const permissions = { ...DEFAULT_USER_PERMISSIONS };
            (permissionsRows || []).forEach((row) => {
                permissions[row.permission_key] = true;
            });
            const normalizedUser = {
                id: authUser.id,
                name: profile?.full_name || authUser.email || 'Usuário',
                role: profile?.role || 'Operador',
                username: profile?.username || authUser.email || 'usuario',
                email: authUser.email || '',
                permissions,
                allowedObraId: profile?.allowed_obra_id || 'all',
                isAdmin: !!profile?.is_admin,
                isActive: profile?.is_active !== false
            };
            setUser((previousUser) => {
                if (!previousUser) {
                    return normalizedUser;
                }
                const sameUser = previousUser.id === normalizedUser.id &&
                    previousUser.name === normalizedUser.name &&
                    previousUser.role === normalizedUser.role &&
                    previousUser.username === normalizedUser.username &&
                    previousUser.email === normalizedUser.email &&
                    previousUser.allowedObraId === normalizedUser.allowedObraId &&
                    previousUser.isAdmin === normalizedUser.isAdmin &&
                    previousUser.isActive === normalizedUser.isActive &&
                    arePermissionsEqual(previousUser.permissions, normalizedUser.permissions);
                return sameUser ? previousUser : normalizedUser;
            });
            setUsers((prev) => {
                const others = prev.filter((u) => u.id !== normalizedUser.id);
                return [normalizedUser, ...others];
            });
            if (normalizedUser.allowedObraId && normalizedUser.allowedObraId !== 'all') {
                setSelectedObraId(normalizedUser.allowedObraId);
            }
            else {
                setSelectedObraId('all');
            }
        }
        catch (error) {
            console.error('Erro ao carregar perfil autenticado:', error);
            setUser(null);
            setUsers([]);
            setSelectedObraId('all');
        }
        finally {
            setAuthLoading(false);
        }
    }, []);
    useEffect(() => {
        let isMounted = true;
        let subscription = null;
        let supabase = null;
        try {
            supabase = getSupabaseClient();
        }
        catch (error) {
            console.error('Supabase não configurado corretamente:', error);
            setAuthLoading(false);
            return () => {
                isMounted = false;
            };
        }
        const bootstrap = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error)
                    throw error;
                if (!isMounted)
                    return;
                await loadAuthenticatedUser(data.session?.user || null);
            }
            catch (error) {
                console.error('Erro ao restaurar sessão:', error);
                if (!isMounted)
                    return;
                setUser(null);
                setUsers([]);
                setSelectedObraId('all');
                setAuthLoading(false);
            }
        };
        bootstrap();
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted)
                return;
            if (event === 'TOKEN_REFRESHED') {
                return;
            }
            const sessionUserId = session?.user?.id || null;
            const currentUserId = currentAuthUserIdRef.current;
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && sessionUserId && currentUserId === sessionUserId) {
                return;
            }
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
                loadAuthenticatedUser(session?.user || null);
            }
        });
        subscription = listener?.subscription || null;
        return () => {
            isMounted = false;
            subscription?.unsubscribe();
        };
    }, [loadAuthenticatedUser]);
    const handleLogin = async (email, password) => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                return { error: error.message || 'Não foi possível autenticar.' };
            }
            await loadAuthenticatedUser(data.user || null);
            addNotification('Login realizado com sucesso.', 'success');
            return { error: null };
        }
        catch (error) {
            return { error: error?.message || 'Falha ao conectar com o Supabase.' };
        }
    };
    const handleLogout = async () => {
        try {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
        }
        finally {
            setUser(null);
            setUsers([]);
            setSelectedObraId('all');
            setActiveView('Dashboard');
        }
    };
    const fetchCoreData = useCallback(async () => {
        if (!user) {
            return;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return;
        }
        try {
            const supabase = getSupabaseClient();
            const [obrasRes, machinesRes, workersRes, maintenanceRes, readingsRes, stoppagesRes, issuesRes, fuelRes, dieselRes, bridgeProjectsRes, bridgeMaterialsRes, bridgeEmployeesRes, bridgeFixedRes, bridgeLogsRes, bridgeLogEquipRes, usinaAggRes, usinaBituRes, usinaProdRes, usinaLoadsRes, usinaTankRes] = await Promise.all([
                supabase.from('obras').select('id, name').is('deleted_at', null).order('name', { ascending: true }),
                supabase.from('equipamentos').select('id, obra_id, prefix, name, brand, model, plate, status, hours, next_maintenance, situation, responsavel, paralisacao_motivo, release_forecast_date, status_change_date, last_status_change_time, last_status_change_at').is('deleted_at', null).order('prefix', { ascending: true }),
                supabase.from('colaboradores').select('id, obra_id, name, role, machine_id').is('deleted_at', null).order('name', { ascending: true }),
                supabase.from('maintenance_tasks').select('id, obra_id, equipment_id, task, due_date, status, priority').is('deleted_at', null).order('due_date', { ascending: true }),
                supabase.from('equipamento_readings').select('id, equipment_id, reading_at, reading_date, reading_value, status').is('deleted_at', null).order('reading_at', { ascending: true }),
                supabase.from('equipamento_stoppages').select('id, equipment_id, start_at, end_at, reason, description').is('deleted_at', null).order('start_at', { ascending: false }),
                supabase.from('equipamento_issues').select('id, equipment_id, status, description, reported_by, reported_at, resolved_by, resolved_at').is('deleted_at', null).order('reported_at', { ascending: false }),
                supabase.from('fuel_records').select('id, obra_id, record_date, machine_id, prefix, machine_name, h_km, diesel, arla, grease, details').is('deleted_at', null).order('record_date', { ascending: false }),
                supabase.from('diesel_deliveries').select('id, obra_id, delivery_date, liters, supplier, ticket_number, price_per_liter, total_cost').is('deleted_at', null).order('delivery_date', { ascending: false }),
                supabase.from('bridge_projects').select('id, obra_id, name, status, start_date, last_check_in_date').is('deleted_at', null).order('start_date', { ascending: false }),
                supabase.from('bridge_materials').select('id, bridge_project_id, receipt_date, emission_date, supplier, doc_type, doc_number, material, quantity, unit, unit_price, freight_value, tax_value, total_value').is('deleted_at', null).order('receipt_date', { ascending: false }),
                supabase.from('bridge_employees').select('id, bridge_project_id, name, role, salary, days_worked, start_date, status, termination_date, breakfast_cost, lunch_cost, dinner_cost, travel_cost, accommodation_cost, total_additional_cost, severance_pending, de_baixada_since').is('deleted_at', null).order('name', { ascending: true }),
                supabase.from('bridge_fixed_costs').select('id, bridge_project_id, description, value, cost_type').is('deleted_at', null).order('created_at', { ascending: false }),
                supabase.from('bridge_daily_logs').select('id, bridge_project_id, log_date, weather, description').is('deleted_at', null).order('log_date', { ascending: false }),
                supabase.from('bridge_daily_log_equipments').select('id, daily_log_id, prefix, daily_cost').is('deleted_at', null).order('created_at', { ascending: false }),
                supabase.from('usina_aggregate_deliveries').select('id, obra_id, delivery_date, product, tons, ticket_number').is('deleted_at', null).order('delivery_date', { ascending: false }),
                supabase.from('usina_bituminous_deliveries').select('id, obra_id, delivery_date, product, tons, ticket_number, plate, supplier').is('deleted_at', null).order('delivery_date', { ascending: false }),
                supabase.from('usina_daily_production').select('id, obra_id, production_date, gross_cbuq, waste, net_cbuq, cap_consumed, brita1_consumed, brita0_consumed, stone_dust_consumed, initial_hour_meter, final_hour_meter, worked_hours').is('deleted_at', null).order('production_date', { ascending: false }),
                supabase.from('usina_load_entries').select('id, obra_id, load_date, plate, tons, temperature').is('deleted_at', null).order('load_date', { ascending: false }),
                supabase.from('usina_tank_capacities').select('id, obra_id, product, capacity_tons').is('deleted_at', null)
            ]);
            const firstError = [
                obrasRes.error,
                machinesRes.error,
                workersRes.error,
                maintenanceRes.error,
                readingsRes.error,
                stoppagesRes.error,
                issuesRes.error,
                fuelRes.error,
                dieselRes.error,
                bridgeProjectsRes.error,
                bridgeMaterialsRes.error,
                bridgeEmployeesRes.error,
                bridgeFixedRes.error,
                bridgeLogsRes.error,
                bridgeLogEquipRes.error,
                usinaAggRes.error,
                usinaBituRes.error,
                usinaProdRes.error,
                usinaLoadsRes.error,
                usinaTankRes.error
            ].find(Boolean);
            if (firstError)
                throw firstError;
            const obrasRows = obrasRes.data || [];
            const machinesRows = machinesRes.data || [];
            const workersRows = workersRes.data || [];
            const maintenanceRows = maintenanceRes.data || [];
            const readingsRows = readingsRes.data || [];
            const stoppagesRows = stoppagesRes.data || [];
            const issuesRows = issuesRes.data || [];
            const fuelRows = fuelRes.data || [];
            const dieselRows = dieselRes.data || [];
            const bridgeProjectsRows = bridgeProjectsRes.data || [];
            const bridgeMaterialsRows = bridgeMaterialsRes.data || [];
            const bridgeEmployeesRows = bridgeEmployeesRes.data || [];
            const bridgeFixedRows = bridgeFixedRes.data || [];
            const bridgeLogsRows = bridgeLogsRes.data || [];
            const bridgeLogEquipRows = bridgeLogEquipRes.data || [];
            const usinaAggRows = usinaAggRes.data || [];
            const usinaBituRows = usinaBituRes.data || [];
            const usinaProdRows = usinaProdRes.data || [];
            const usinaLoadsRows = usinaLoadsRes.data || [];
            const usinaTankRows = usinaTankRes.data || [];
            const readingsByEquipment = {};
            readingsRows.forEach((row) => {
                if (!readingsByEquipment[row.equipment_id]) {
                    readingsByEquipment[row.equipment_id] = [];
                }
                readingsByEquipment[row.equipment_id].push({
                    date: row.reading_date || normalizeDateFromTs(row.reading_at),
                    value: Number(row.reading_value || 0),
                    status: row.status || MachineStatus.Operating
                });
            });
            const stoppagesByEquipment = {};
            stoppagesRows.forEach((row) => {
                if (!stoppagesByEquipment[row.equipment_id]) {
                    stoppagesByEquipment[row.equipment_id] = [];
                }
                stoppagesByEquipment[row.equipment_id].push({
                    id: row.id,
                    startDate: normalizeDateFromTs(row.start_at),
                    startTime: normalizeTimeFromTs(row.start_at),
                    endDate: row.end_at ? normalizeDateFromTs(row.end_at) : null,
                    endTime: row.end_at ? normalizeTimeFromTs(row.end_at) : null,
                    reason: row.reason,
                    description: row.description || ''
                });
            });
            const pendingIssuesByEquipment = {};
            const resolvedIssuesByEquipment = {};
            issuesRows.forEach((row) => {
                const item = {
                    id: row.id,
                    date: normalizeDateFromTs(row.reported_at),
                    time: normalizeTimeFromTs(row.reported_at),
                    description: row.description,
                    reportedBy: row.reported_by || 'Operador'
                };
                if (row.status === 'resolved') {
                    if (!resolvedIssuesByEquipment[row.equipment_id]) {
                        resolvedIssuesByEquipment[row.equipment_id] = [];
                    }
                    resolvedIssuesByEquipment[row.equipment_id].push({
                        ...item,
                        originalDate: item.date,
                        originalTime: item.time,
                        resolvedDate: normalizeDateFromTs(row.resolved_at),
                        resolvedTime: normalizeTimeFromTs(row.resolved_at)
                    });
                }
                else {
                    if (!pendingIssuesByEquipment[row.equipment_id]) {
                        pendingIssuesByEquipment[row.equipment_id] = [];
                    }
                    pendingIssuesByEquipment[row.equipment_id].push(item);
                }
            });
            const supplyLogsByMachine = {};
            fuelRows.forEach((row) => {
                if (!row.machine_id)
                    return;
                if (!supplyLogsByMachine[row.machine_id]) {
                    supplyLogsByMachine[row.machine_id] = [];
                }
                supplyLogsByMachine[row.machine_id].push({
                    id: row.id,
                    date: row.record_date,
                    diesel: Number(row.diesel || 0),
                    arla: Number(row.arla || 0),
                    grease: row.grease || '-',
                    details: row.details || ''
                });
            });
            const normalizedObras = (obrasRows || []).map((obra) => ({
                id: obra.id,
                name: obra.name
            }));
            const normalizedMachines = (machinesRows || []).map((machine) => ({
                id: machine.id,
                obraId: machine.obra_id,
                prefix: machine.prefix,
                name: machine.name,
                brand: machine.brand || '',
                model: machine.model || '',
                plate: machine.plate || '',
                status: machine.status || MachineStatus.Operating,
                hours: Number(machine.hours || 0),
                nextMaintenance: machine.next_maintenance || todayStr(),
                situation: machine.situation || '',
                responsavel: machine.responsavel || '',
                paralisacaoMotivo: machine.paralisacao_motivo || '',
                releaseForecastDate: machine.release_forecast_date || '',
                statusChangeDate: machine.status_change_date || normalizeDateFromTs(machine.last_status_change_at) || '',
                lastStatusChangeTime: machine.last_status_change_time || normalizeTimeFromTs(machine.last_status_change_at) || '',
                readings: readingsByEquipment[machine.id] || [],
                stoppageHistory: stoppagesByEquipment[machine.id] || [],
                pendingIssues: pendingIssuesByEquipment[machine.id] || [],
                resolvedIssues: resolvedIssuesByEquipment[machine.id] || [],
                supplyLogs: supplyLogsByMachine[machine.id] || []
            }));
            const normalizedWorkers = (workersRows || []).map((worker) => ({
                id: worker.id,
                name: worker.name,
                role: worker.role,
                machineId: worker.machine_id || undefined,
                obraId: worker.obra_id
            }));
            const normalizedMaintenance = (maintenanceRows || []).map((task) => ({
                id: task.id,
                machineId: task.equipment_id,
                obraId: task.obra_id,
                task: task.task,
                dueDate: task.due_date,
                status: task.status || 'pending',
                priority: task.priority || 'media'
            }));
            const normalizedFuelRecords = (fuelRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id || null,
                date: row.record_date,
                machineId: row.machine_id || 'external',
                prefix: row.prefix || 'AVULSO',
                machineName: row.machine_name || 'Equipamento Avulso',
                h_km: row.h_km || '',
                diesel: String(row.diesel ?? 0),
                arla: String(row.arla ?? 0),
                grease: row.grease || '-',
                details: row.details || ''
            }));
            const normalizedDieselDeliveries = (dieselRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id || null,
                date: row.delivery_date,
                liters: Number(row.liters || 0),
                supplier: row.supplier,
                ticketNumber: row.ticket_number || '',
                pricePerLiter: row.price_per_liter ? Number(row.price_per_liter) : undefined,
                totalCost: row.total_cost ? Number(row.total_cost) : undefined
            }));
            const normalizedBridgeProjects = (bridgeProjectsRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id,
                name: row.name,
                status: row.status || 'Em Execucao',
                startDate: row.start_date || todayStr(),
                lastCheckInDate: row.last_check_in_date || ''
            }));
            const normalizedBridgeMaterials = (bridgeMaterialsRows || []).map((row) => ({
                id: row.id,
                bridgeProjectId: row.bridge_project_id,
                receiptDate: row.receipt_date,
                emissionDate: row.emission_date || row.receipt_date,
                supplier: row.supplier || '',
                docType: row.doc_type || 'NF',
                docNumber: row.doc_number || '',
                material: row.material,
                quantity: Number(row.quantity || 0),
                unit: row.unit || 'un',
                unitPrice: Number(row.unit_price || 0),
                freightValue: Number(row.freight_value || 0),
                taxValue: Number(row.tax_value || 0),
                totalValue: Number(row.total_value || (Number(row.quantity || 0) * Number(row.unit_price || 0) + Number(row.freight_value || 0) + Number(row.tax_value || 0)))
            }));
            const normalizedBridgeEmployees = (bridgeEmployeesRows || []).map((row) => ({
                id: row.id,
                bridgeProjectId: row.bridge_project_id,
                name: row.name,
                role: row.role,
                salary: Number(row.salary || 0),
                daysWorked: Number(row.days_worked || 0),
                startDate: row.start_date || todayStr(),
                status: row.status || 'Trabalhando',
                terminationDate: row.termination_date || undefined,
                breakfastCost: Number(row.breakfast_cost || 0),
                lunchCost: Number(row.lunch_cost || 0),
                dinnerCost: Number(row.dinner_cost || 0),
                travelCost: Number(row.travel_cost || 0),
                accommodationCost: Number(row.accommodation_cost || 0),
                totalAdditionalCost: Number(row.total_additional_cost || 0),
                severancePending: !!row.severance_pending,
                deBaixadaSince: row.de_baixada_since || null
            }));
            const normalizedBridgeFixedCosts = (bridgeFixedRows || []).map((row) => ({
                id: row.id,
                bridgeProjectId: row.bridge_project_id,
                description: row.description,
                value: Number(row.value || 0),
                type: row.cost_type || 'Mensal'
            }));
            const equipmentByDailyLog = {};
            bridgeLogEquipRows.forEach((row) => {
                if (!equipmentByDailyLog[row.daily_log_id]) {
                    equipmentByDailyLog[row.daily_log_id] = [];
                }
                equipmentByDailyLog[row.daily_log_id].push({
                    id: row.id,
                    prefix: row.prefix || '',
                    dailyCost: Number(row.daily_cost || 0)
                });
            });
            const normalizedDailyLogs = (bridgeLogsRows || []).map((row) => ({
                id: row.id,
                bridgeProjectId: row.bridge_project_id,
                date: row.log_date,
                weather: row.weather || 'Sol',
                description: row.description || '',
                equipmentList: equipmentByDailyLog[row.id] || []
            }));
            const normalizedUsinaDeliveries = (usinaAggRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id || null,
                date: row.delivery_date,
                product: row.product,
                tons: Number(row.tons || 0),
                ticketNumber: row.ticket_number || ''
            }));
            const normalizedUsinaBitu = (usinaBituRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id || null,
                date: row.delivery_date,
                product: row.product,
                tons: Number(row.tons || 0),
                ticketNumber: row.ticket_number || '',
                plate: row.plate || '',
                supplier: row.supplier || ''
            }));
            const normalizedUsinaProd = (usinaProdRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id || null,
                date: row.production_date,
                grossCbuq: Number(row.gross_cbuq || 0),
                waste: Number(row.waste || 0),
                netCbuq: Number(row.net_cbuq || 0),
                capConsumed: Number(row.cap_consumed || 0),
                brita1Consumed: Number(row.brita1_consumed || 0),
                brita0Consumed: Number(row.brita0_consumed || 0),
                stoneDustConsumed: Number(row.stone_dust_consumed || 0),
                initialHourMeter: Number(row.initial_hour_meter || 0),
                finalHourMeter: Number(row.final_hour_meter || 0),
                workedHours: Number(row.worked_hours || 0)
            }));
            const normalizedUsinaLoads = (usinaLoadsRows || []).map((row) => ({
                id: row.id,
                obraId: row.obra_id || null,
                date: row.load_date,
                plate: row.plate || '',
                tons: Number(row.tons || 0),
                temperature: Number(row.temperature || 0)
            }));
            const normalizedTankCapacities = { ...DEFAULT_TANK_CAPACITIES };
            const activeUsinaObraId = selectedObraId !== 'all'
                ? selectedObraId
                : (user?.allowedObraId && user.allowedObraId !== 'all' ? user.allowedObraId : null);
            usinaTankRows.forEach((row) => {
                if (row.product) {
                    if (activeUsinaObraId && row.obra_id !== activeUsinaObraId)
                        return;
                    normalizedTankCapacities[row.product] = Number(row.capacity_tons || 0);
                }
            });
            setObras(normalizedObras);
            setMachines(normalizedMachines);
            setWorkers(normalizedWorkers);
            setMaintenanceTasks(normalizedMaintenance);
            setFuelRecords(normalizedFuelRecords);
            setDieselDeliveries(normalizedDieselDeliveries);
            setBridgeProjects(normalizedBridgeProjects);
            setBridgeMaterials(normalizedBridgeMaterials);
            setBridgeEmployees(normalizedBridgeEmployees);
            setBridgeFixedCosts(normalizedBridgeFixedCosts);
            setDailyLogs(normalizedDailyLogs);
            setBridgeWithdrawals([]);
            setBridgeEvents([]);
            setBridgeServices([]);
            setBridgeMaterialRequests([]);
            setUsinaDeliveries(normalizedUsinaDeliveries);
            setUsinaBitu(normalizedUsinaBitu);
            setUsinaProd(normalizedUsinaProd);
            setUsinaLoads(normalizedUsinaLoads);
            setBituTankCapacities(normalizedTankCapacities);
            saveSnapshotCache(user.id, {
                obras: normalizedObras,
                machines: normalizedMachines,
                workers: normalizedWorkers,
                maintenanceTasks: normalizedMaintenance,
                fuelRecords: normalizedFuelRecords,
                dieselDeliveries: normalizedDieselDeliveries,
                bridgeProjects: normalizedBridgeProjects,
                bridgeMaterials: normalizedBridgeMaterials,
                bridgeEmployees: normalizedBridgeEmployees,
                bridgeFixedCosts: normalizedBridgeFixedCosts,
                dailyLogs: normalizedDailyLogs,
                usinaDeliveries: normalizedUsinaDeliveries,
                usinaBitu: normalizedUsinaBitu,
                usinaProd: normalizedUsinaProd,
                usinaLoads: normalizedUsinaLoads,
                bituTankCapacities: normalizedTankCapacities
            });
            if (user.allowedObraId && user.allowedObraId !== 'all') {
                const hasAllowedObra = normalizedObras.some((obra) => obra.id === user.allowedObraId);
                setSelectedObraId(hasAllowedObra ? user.allowedObraId : 'all');
            }
            else if (selectedObraId !== 'all' && !normalizedObras.some((obra) => obra.id === selectedObraId)) {
                setSelectedObraId('all');
            }
        }
        catch (error) {
            console.error('Erro ao carregar dados base do Supabase:', error);
            addNotification('Não foi possível carregar dados base do Supabase.', 'alert', { skipAudit: true, localOnly: true, dedupeWindowMs: 300000 });
        }
    }, [saveSnapshotCache, selectedObraId, user]);
    useEffect(() => {
        if (!user) {
            return;
        }
        fetchCoreData();
    }, [fetchCoreData, user]);
    useEffect(() => {
        if (!user?.id) {
            return;
        }
        const snapshot = loadSnapshotCache(user.id);
        if (!snapshot) {
            return;
        }
        setObras(snapshot.obras || []);
        setMachines(snapshot.machines || []);
        setWorkers(snapshot.workers || []);
        setMaintenanceTasks(snapshot.maintenanceTasks || []);
        setFuelRecords(snapshot.fuelRecords || []);
        setDieselDeliveries(snapshot.dieselDeliveries || []);
        setBridgeProjects(snapshot.bridgeProjects || []);
        setBridgeMaterials(snapshot.bridgeMaterials || []);
        setBridgeEmployees(snapshot.bridgeEmployees || []);
        setBridgeFixedCosts(snapshot.bridgeFixedCosts || []);
        setDailyLogs(snapshot.dailyLogs || []);
        setUsinaDeliveries(snapshot.usinaDeliveries || []);
        setUsinaBitu(snapshot.usinaBitu || []);
        setUsinaProd(snapshot.usinaProd || []);
        setUsinaLoads(snapshot.usinaLoads || []);
        setBituTankCapacities(snapshot.bituTankCapacities || { ...DEFAULT_TANK_CAPACITIES });
    }, [loadSnapshotCache, user?.id]);
    const fetchUsers = useCallback(async () => {
        if (!user?.permissions?.editConfiguracoes) {
            return;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return;
        }
        setUsersLoading(true);
        try {
            const supabase = getSupabaseClient();
            const [{ data: profilesRows, error: profilesError }, { data: permissionsRows, error: permissionsError }] = await Promise.all([
                supabase.from('profiles').select('id, full_name, username, role, allowed_obra_id, is_admin, is_active').is('deleted_at', null).order('full_name', { ascending: true }),
                supabase.from('profile_permissions').select('profile_id, permission_key, allowed')
            ]);
            if (profilesError)
                throw profilesError;
            if (permissionsError)
                throw permissionsError;
            const permissionsByUser = {};
            (permissionsRows || []).forEach((row) => {
                if (!permissionsByUser[row.profile_id]) {
                    permissionsByUser[row.profile_id] = { ...DEFAULT_USER_PERMISSIONS };
                }
                if (row.allowed) {
                    permissionsByUser[row.profile_id][row.permission_key] = true;
                }
            });
            const normalizedUsers = (profilesRows || []).map((profile) => ({
                id: profile.id,
                name: profile.full_name || profile.username || 'Usuário',
                role: profile.role || 'Operador',
                username: profile.username || '',
                allowedObraId: profile.allowed_obra_id || 'all',
                isAdmin: !!profile.is_admin,
                isActive: profile.is_active !== false,
                permissions: permissionsByUser[profile.id] || { ...DEFAULT_USER_PERMISSIONS }
            }));
            setUsers(normalizedUsers);
        }
        catch (error) {
            console.error('Erro ao carregar usuários:', error);
            addNotification('Não foi possível carregar usuários/permissões.', 'alert', { skipAudit: true, localOnly: true, dedupeWindowMs: 300000 });
        }
        finally {
            setUsersLoading(false);
        }
    }, [user]);
    useEffect(() => {
        if (!user?.permissions?.editConfiguracoes) {
            return;
        }
        fetchUsers();
    }, [fetchUsers, user]);
    const flushOfflineQueue = useCallback(async () => {
        if (!user || typeof navigator !== 'undefined' && !navigator.onLine) {
            return;
        }
        if (flushingOfflineQueueRef.current) {
            return;
        }
        const queue = getOfflineQueue();
        if (!queue.length) {
            pendingSyncAlertCountRef.current = 0;
            return;
        }
        flushingOfflineQueueRef.current = true;
        setSyncingOfflineQueue(true);
        const supabase = getSupabaseClient();
        const pending = [...queue];
        const failed = [];
        let flushedCount = 0;
        try {
            while (pending.length) {
                const action = pending.shift();
                try {
                    await runDbAction(supabase, action);
                    flushedCount += 1;
                }
                catch (_error) {
                    failed.push(action);
                }
            }
            setOfflineQueue(failed);
            if (flushedCount > 0) {
                addNotification(`${flushedCount} alteracoes offline sincronizadas.`, 'success', { skipAudit: true, localOnly: true });
                await fetchCoreData();
                if (user?.permissions?.editConfiguracoes) {
                    await fetchUsers();
                }
            }
            if (failed.length > 0) {
                if (pendingSyncAlertCountRef.current !== failed.length) {
                    addNotification(`${failed.length} alteracoes continuam pendentes para sincronizar.`, 'alert', {
                        skipAudit: true,
                        localOnly: true,
                        dedupeWindowMs: 1800000
                    });
                    pendingSyncAlertCountRef.current = failed.length;
                }
            }
            else {
                pendingSyncAlertCountRef.current = 0;
            }
        }
        finally {
            flushingOfflineQueueRef.current = false;
            setSyncingOfflineQueue(false);
        }
    }, [fetchCoreData, fetchUsers, getOfflineQueue, runDbAction, setOfflineQueue, user]);
    useEffect(() => {
        if (!user) {
            return;
        }
        flushOfflineQueue();
        const handleOnline = () => {
            flushOfflineQueue();
        };
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [flushOfflineQueue, user]);
    const handleResolveIssue = async (machineId, issueId) => {
        const now = new Date();
        const targetMachine = machines.find((m) => m.id === machineId);
        const targetIssue = targetMachine?.pendingIssues?.find((i) => i.id === issueId);
        setMachines(prev => prev.map(m => {
            if (m.id === machineId) {
                const issue = m.pendingIssues?.find(i => i.id === issueId);
                if (issue) {
                    const resolved = { ...issue, originalDate: issue.date, originalTime: issue.time, resolvedDate: now.toISOString().split('T')[0], resolvedTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
                    return { ...m, pendingIssues: m.pendingIssues?.filter(i => i.id !== issueId), resolvedIssues: [...(m.resolvedIssues || []), resolved] };
                }
            }
            return m;
        }));
        if (targetIssue) {
            await executeDbAction({
                type: 'update',
                table: 'equipamento_issues',
                payload: {
                    status: 'resolved',
                    resolved_by: user?.name || 'Operador',
                    resolved_at: nowIso(),
                    client_updated_at: nowIso()
                },
                match: { id: targetIssue.id }
            }, { silentOffline: true });
        }
    };
    // Lógica para salvar horímetro E OBSERVAÇÕES
    const handleSaveHorimetro = async (machineId, reading, observation, reportedBy) => {
        const newHours = parseFloat(reading);
        const today = todayStr();
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const targetMachine = machines.find((m) => m.id === machineId);
        const issueId = observation ? createUuid() : null;
        setMachines(prev => prev.map(m => {
            if (m.id === machineId) {
                // 1. Atualiza leituras
                const updatedReadings = [...(m.readings || []), { date: today, value: newHours, status: m.status }];
                // 2. Se houver observação, adiciona como pendência (aparecerá na Oficina)
                let updatedPendingIssues = m.pendingIssues || [];
                if (observation) {
                    updatedPendingIssues = [...updatedPendingIssues, {
                            id: issueId,
                            date: today,
                            time: timeStr,
                            description: observation,
                            reportedBy: reportedBy || 'Operador'
                        }];
                }
                return {
                    ...m,
                    hours: newHours,
                    readings: updatedReadings,
                    pendingIssues: updatedPendingIssues
                };
            }
            return m;
        }));
        if (targetMachine) {
            const stamp = nowIso();
            await executeDbAction({
                type: 'update',
                table: 'equipamentos',
                payload: { hours: Number(newHours || 0), client_updated_at: stamp },
                match: { id: machineId }
            }, { silentOffline: true });
            await executeDbAction({
                type: 'upsert',
                table: 'equipamento_readings',
                payload: {
                    id: createUuid(),
                    obra_id: targetMachine.obraId,
                    equipment_id: machineId,
                    reading_at: stamp,
                    reading_value: Number(newHours || 0),
                    status: targetMachine.status,
                    observation: observation || null,
                    reported_by: reportedBy || 'Operador',
                    client_updated_at: stamp
                },
                onConflict: 'id'
            }, { silentOffline: true });
            if (observation) {
                await executeDbAction({
                    type: 'upsert',
                    table: 'equipamento_issues',
                    payload: {
                        id: issueId,
                        obra_id: targetMachine.obraId,
                        equipment_id: machineId,
                        status: 'pending',
                        description: observation,
                        reported_by: reportedBy || 'Operador',
                        reported_at: stamp,
                        client_updated_at: stamp
                    },
                    onConflict: 'id'
                }, { silentOffline: true });
            }
        }
        setHorimetroModalOpen(false);
        addNotification(`Dados salvos para ${machines.find(m => m.id === machineId)?.prefix}`, 'success');
    };
    // Lógica para atualizar status (gestão em campo) com Histórico COMPLETO
    const handleUpdateStatus = async (machineId, newStatus) => {
        const today = todayStr();
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const stamp = nowIso();
        const machine = machines.find((m) => m.id === machineId);
        setMachines(prev => prev.map(m => {
            if (m.id === machineId) {
                // 1. Calculate History Update
                let updatedHistory = m.stoppageHistory ? [...m.stoppageHistory] : [];
                const isStopping = (newStatus === MachineStatus.Maintenance || newStatus === MachineStatus.MechanicalProblem);
                const wasStopped = (m.status === MachineStatus.Maintenance || m.status === MachineStatus.MechanicalProblem);
                // CASE A: Machine stops (Start of problem/maintenance - Entering Workshop)
                if (isStopping && !wasStopped) {
                    updatedHistory.push({
                        startDate: today,
                        startTime: timeStr,
                        endDate: null,
                        reason: newStatus,
                        description: `Entrada em ${newStatus}`
                    });
                }
                // CASE B: Machine resumes (End of problem/maintenance - Leaving Workshop)
                else if (!isStopping && wasStopped) {
                    // Close the last open entry
                    // We look for the last entry that has no endDate
                    const openRecordIndex = updatedHistory.findIndex(h => h.endDate === null);
                    if (openRecordIndex !== -1) {
                        updatedHistory[openRecordIndex] = {
                            ...updatedHistory[openRecordIndex],
                            endDate: today,
                            endTime: timeStr
                        };
                    }
                }
                // CASE C: Change between stopping reasons (e.g. Mechanical -> Maintenance)
                else if (isStopping && wasStopped && m.status !== newStatus) {
                    // Close previous
                    const openRecordIndex = updatedHistory.findIndex(h => h.endDate === null);
                    if (openRecordIndex !== -1) {
                        updatedHistory[openRecordIndex] = {
                            ...updatedHistory[openRecordIndex],
                            endDate: today,
                            endTime: timeStr
                        };
                    }
                    // Open new
                    updatedHistory.push({
                        startDate: today,
                        startTime: timeStr,
                        endDate: null,
                        reason: newStatus,
                        description: `Mudança de status: ${m.status} -> ${newStatus}`
                    });
                }
                return {
                    ...m,
                    status: newStatus,
                    statusChangeDate: today,
                    lastStatusChangeTime: timeStr,
                    stoppageHistory: updatedHistory
                };
            }
            return m;
        }));
        if (machine) {
            const isStopping = (newStatus === MachineStatus.Maintenance || newStatus === MachineStatus.MechanicalProblem);
            const wasStopped = (machine.status === MachineStatus.Maintenance || machine.status === MachineStatus.MechanicalProblem);
            await executeDbAction({
                type: 'update',
                table: 'equipamentos',
                payload: {
                    status: newStatus,
                    status_change_date: today,
                    last_status_change_time: timeStr,
                    last_status_change_at: stamp,
                    client_updated_at: stamp
                },
                match: { id: machineId }
            }, { silentOffline: true });
            if (isStopping && !wasStopped) {
                await executeDbAction({
                    type: 'upsert',
                    table: 'equipamento_stoppages',
                    payload: {
                        id: createUuid(),
                        obra_id: machine.obraId,
                        equipment_id: machineId,
                        start_at: stamp,
                        reason: newStatus,
                        description: `Entrada em ${newStatus}`,
                        client_updated_at: stamp
                    },
                    onConflict: 'id'
                }, { silentOffline: true });
            }
            if (!isStopping && wasStopped) {
                await executeDbAction({
                    type: 'update',
                    table: 'equipamento_stoppages',
                    payload: { end_at: stamp, client_updated_at: stamp },
                    match: { equipment_id: machineId },
                    matchIs: { end_at: null }
                }, { silentOffline: true });
            }
            if (isStopping && wasStopped && machine.status !== newStatus) {
                await executeDbAction({
                    type: 'update',
                    table: 'equipamento_stoppages',
                    payload: { end_at: stamp, client_updated_at: stamp },
                    match: { equipment_id: machineId },
                    matchIs: { end_at: null }
                }, { silentOffline: true });
                await executeDbAction({
                    type: 'upsert',
                    table: 'equipamento_stoppages',
                    payload: {
                        id: createUuid(),
                        obra_id: machine.obraId,
                        equipment_id: machineId,
                        start_at: stamp,
                        reason: newStatus,
                        description: `Mudanca de status: ${machine.status} -> ${newStatus}`,
                        client_updated_at: stamp
                    },
                    onConflict: 'id'
                }, { silentOffline: true });
            }
        }
        setStatusUpdateModalOpen(false);
        addNotification(`Status atualizado para ${newStatus}`, newStatus === 'Operando' ? 'success' : 'alert');
    };
    const handleSaveOficinaDetails = async (machineId, details) => {
        const previousMachine = machines.find((item) => item.id === machineId);
        const previousForecastDate = previousMachine?.releaseForecastDate || '';
        setMachines(prev => prev.map(m => {
            if (m.id === machineId) {
                return { ...m, ...details };
            }
            return m;
        }));
        await executeDbAction({
            type: 'update',
            table: 'equipamentos',
            payload: {
                situation: details.situation || null,
                responsavel: details.responsavel || null,
                paralisacao_motivo: details.paralisacaoMotivo || null,
                release_forecast_date: details.releaseForecastDate || null,
                client_updated_at: nowIso()
            },
            match: { id: machineId }
        }, { silentOffline: true });
        setOficinaEditModalOpen(false);
        const nextForecastDate = details.releaseForecastDate || '';
        if (previousForecastDate !== nextForecastDate) {
            const machinePrefix = previousMachine?.prefix || 'equipamento';
            const previousLabel = previousForecastDate ? new Date(`${previousForecastDate}T00:00:00`).toLocaleDateString('pt-BR') : 'sem previsão';
            const nextLabel = nextForecastDate ? new Date(`${nextForecastDate}T00:00:00`).toLocaleDateString('pt-BR') : 'sem previsão';
            addNotification(`Previsão de liberação do ${machinePrefix} alterada de ${previousLabel} para ${nextLabel}.`, 'info', {
                dedupeWindowMs: 0,
                metadata: {
                    event: 'forecast_update',
                    machineId,
                    machinePrefix,
                    fromLabel: previousLabel,
                    toLabel: nextLabel,
                    previousDate: previousForecastDate || null,
                    nextDate: nextForecastDate || null
                }
            });
        }
        addNotification('Detalhes da oficina atualizados com sucesso', 'success');
    };
    // HANDLERS FOR DATABASE VIEW
    const handleSaveMachineData = async (data, machineId) => {
        try {
            const id = machineId || createUuid();
            const currentMachine = machines.find((m) => m.id === machineId);
            const payload = {
                id,
                obra_id: data.obraId,
                prefix: data.prefix,
                name: data.name,
                brand: data.brand,
                model: data.model,
                plate: data.plate || null,
                status: currentMachine?.status || MachineStatus.Operating,
                hours: Number(data.hours || 0),
                next_maintenance: currentMachine?.nextMaintenance || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                client_updated_at: nowIso()
            };
            await executeDbAction({ type: 'upsert', table: 'equipamentos', payload, onConflict: 'id' });
            await fetchCoreData();
            addNotification(machineId ? 'Máquina atualizada com sucesso' : 'Nova máquina cadastrada', 'success');
            setMachineModalOpen(false);
        }
        catch (error) {
            console.error('Erro ao salvar maquina:', error);
            addNotification('Falha ao salvar máquina no Supabase.', 'alert');
        }
    };
    const handleDeleteMachine = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta máquina?'))
            return;
        try {
            await executeDbAction({
                type: 'update',
                table: 'equipamentos',
                payload: { deleted_at: nowIso(), client_updated_at: nowIso() },
                match: { id }
            });
            await fetchCoreData();
            addNotification('Máquina excluída', 'info');
        }
        catch (error) {
            console.error('Erro ao excluir maquina:', error);
            addNotification('Falha ao excluir máquina no Supabase.', 'alert');
        }
    };
    const handleSaveObra = async (data, id) => {
        try {
            const payload = {
                id: id || createUuid(),
                name: data.name,
                client_updated_at: nowIso()
            };
            await executeDbAction({ type: 'upsert', table: 'obras', payload, onConflict: 'id' });
            await fetchCoreData();
            addNotification(id ? 'Obra atualizada' : 'Nova obra cadastrada', 'success');
            setObraModalOpen(false);
        }
        catch (error) {
            console.error('Erro ao salvar obra:', error);
            addNotification('Falha ao salvar obra no Supabase.', 'alert');
        }
    };
    const handleDeleteObra = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta obra?'))
            return;
        try {
            await executeDbAction({
                type: 'update',
                table: 'obras',
                payload: { deleted_at: nowIso(), client_updated_at: nowIso() },
                match: { id }
            });
            await fetchCoreData();
            addNotification('Obra excluída', 'info');
        }
        catch (error) {
            console.error('Erro ao excluir obra:', error);
            addNotification('Falha ao excluir obra no Supabase.', 'alert');
        }
    };
    const handleSaveWorker = async (data, id) => {
        try {
            const linkedMachine = data.machineId ? machines.find((machine) => machine.id === data.machineId) : null;
            const inferredObraId = linkedMachine?.obraId || (selectedObraId !== 'all' ? selectedObraId : obras[0]?.id);
            if (!inferredObraId) {
                addNotification('Cadastre uma obra antes de cadastrar trabalhadores.', 'alert');
                return;
            }
            const payload = {
                id: id || createUuid(),
                obra_id: inferredObraId,
                name: data.name,
                role: data.role,
                machine_id: data.machineId || null,
                client_updated_at: nowIso()
            };
            await executeDbAction({ type: 'upsert', table: 'colaboradores', payload, onConflict: 'id' });
            await fetchCoreData();
            addNotification(id ? 'Trabalhador atualizado' : 'Novo trabalhador cadastrado', 'success');
            setWorkerModalOpen(false);
        }
        catch (error) {
            console.error('Erro ao salvar trabalhador:', error);
            addNotification('Falha ao salvar trabalhador no Supabase.', 'alert');
        }
    };
    const handleDeleteWorker = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este trabalhador?'))
            return;
        try {
            await executeDbAction({
                type: 'update',
                table: 'colaboradores',
                payload: { deleted_at: nowIso(), client_updated_at: nowIso() },
                match: { id }
            });
            await fetchCoreData();
            addNotification('Trabalhador excluído', 'info');
        }
        catch (error) {
            console.error('Erro ao excluir trabalhador:', error);
            addNotification('Falha ao excluir trabalhador no Supabase.', 'alert');
        }
    };
    const inferCurrentObraId = useCallback((fallbackMachineId) => {
        const machineObra = fallbackMachineId ? machines.find((machine) => machine.id === fallbackMachineId)?.obraId : null;
        if (machineObra)
            return machineObra;
        if (selectedObraId && selectedObraId !== 'all')
            return selectedObraId;
        if (user?.allowedObraId && user.allowedObraId !== 'all')
            return user.allowedObraId;
        return obras[0]?.id || null;
    }, [machines, obras, selectedObraId, user]);
    const syncCollectionChanges = useCallback(async ({ table, previous, next, toPayload, onConflict = 'id' }) => {
        const previousMap = new Map((previous || []).map((item) => [item.id, item]));
        const nextMap = new Map((next || []).map((item) => [item.id, item]));
        for (const item of next || []) {
            const oldItem = previousMap.get(item.id);
            if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
                const payload = toPayload(item);
                if (payload) {
                    await executeDbAction({ type: 'upsert', table, payload, onConflict }, { silentOffline: true });
                }
            }
        }
        for (const oldItem of previous || []) {
            if (!nextMap.has(oldItem.id)) {
                await executeDbAction({
                    type: 'update',
                    table,
                    payload: { deleted_at: nowIso(), client_updated_at: nowIso() },
                    match: { id: oldItem.id }
                }, { silentOffline: true });
            }
        }
    }, [executeDbAction]);
    const handleSaveMaintenanceTask = async ({ machineId, task, dueDate }) => {
        const machine = machines.find((item) => item.id === machineId);
        if (!machine) {
            addNotification('Equipamento não encontrado para agendamento.', 'alert');
            return;
        }
        const item = {
            id: createUuid(),
            machineId,
            obraId: machine.obraId,
            task,
            dueDate,
            status: 'pending',
            priority: 'media'
        };
        setMaintenanceTasks((prev) => [item, ...prev]);
        await executeDbAction({
            type: 'upsert',
            table: 'maintenance_tasks',
            payload: {
                id: item.id,
                obra_id: item.obraId,
                equipment_id: machineId,
                task,
                due_date: dueDate,
                status: 'pending',
                priority: 'media',
                client_updated_at: nowIso()
            },
            onConflict: 'id'
        }, { silentOffline: true });
        setMaintenanceModalOpen(false);
        addNotification('Manutencao agendada.', 'success');
    };
    const handleSyncMachineHours = async (machineId, newHours) => {
        setMachines((prev) => prev.map((item) => item.id === machineId ? { ...item, hours: Number(newHours || 0) } : item));
        await executeDbAction({
            type: 'update',
            table: 'equipamentos',
            payload: { hours: Number(newHours || 0), client_updated_at: nowIso() },
            match: { id: machineId }
        }, { silentOffline: true });
    };
    const handleSetFuelRecords = useCallback((updater) => {
        setFuelRecords((prev) => {
            const next = normalizeListIds(resolveUpdater(updater, prev));
            const nextWithObra = next.map((row) => {
                if (row?.obraId)
                    return row;
                const obraId = inferCurrentObraId(row.machineId && row.machineId !== 'external' ? row.machineId : null);
                return obraId ? { ...row, obraId } : row;
            });
            void syncCollectionChanges({
                table: 'fuel_records',
                previous: prev,
                next: nextWithObra,
                toPayload: (row) => {
                    const obraId = inferCurrentObraId(row.machineId && row.machineId !== 'external' ? row.machineId : null);
                    if (!obraId)
                        return null;
                    return {
                        id: row.id,
                        obra_id: row.obraId || obraId,
                        machine_id: row.machineId && row.machineId !== 'external' ? row.machineId : null,
                        record_date: row.date || todayStr(),
                        prefix: row.prefix || '',
                        machine_name: row.machineName || '',
                        h_km: row.h_km || '',
                        diesel: toFiniteNumber(row.diesel, 0),
                        arla: toFiniteNumber(row.arla, 0),
                        grease: row.grease || null,
                        details: row.details || null,
                        client_updated_at: nowIso()
                    };
                }
            });
            return nextWithObra;
        });
    }, [inferCurrentObraId, syncCollectionChanges]);
    const handleSetDieselDeliveries = useCallback((updater) => {
        setDieselDeliveries((prev) => {
            const next = normalizeListIds(resolveUpdater(updater, prev));
            const nextWithObra = next.map((row) => {
                if (row?.obraId)
                    return row;
                const obraId = inferCurrentObraId();
                return obraId ? { ...row, obraId } : row;
            });
            void syncCollectionChanges({
                table: 'diesel_deliveries',
                previous: prev,
                next: nextWithObra,
                toPayload: (row) => {
                    const obraId = inferCurrentObraId();
                    if (!obraId)
                        return null;
                    return {
                        id: row.id,
                        obra_id: row.obraId || obraId,
                        delivery_date: row.date || todayStr(),
                        liters: Number(row.liters || 0),
                        supplier: row.supplier || 'Sem fornecedor',
                        ticket_number: row.ticketNumber || null,
                        price_per_liter: row.pricePerLiter ? Number(row.pricePerLiter) : null,
                        total_cost: row.totalCost ? Number(row.totalCost) : null,
                        client_updated_at: nowIso()
                    };
                }
            });
            return nextWithObra;
        });
    }, [inferCurrentObraId, syncCollectionChanges]);
    const handleSetUsinaDeliveries = useCallback((updater) => {
        setUsinaDeliveries((prev) => {
            const next = normalizeListIds(resolveUpdater(updater, prev));
            const nextWithObra = next.map((row) => {
                if (row?.obraId)
                    return row;
                const obraId = inferCurrentObraId();
                return obraId ? { ...row, obraId } : row;
            });
            void syncCollectionChanges({
                table: 'usina_aggregate_deliveries',
                previous: prev,
                next: nextWithObra,
                toPayload: (row) => {
                    const obraId = inferCurrentObraId();
                    if (!obraId)
                        return null;
                    return {
                        id: row.id,
                        obra_id: row.obraId || obraId,
                        delivery_date: row.date || todayStr(),
                        product: row.product,
                        tons: Number(row.tons || 0),
                        ticket_number: row.ticketNumber || null,
                        client_updated_at: nowIso()
                    };
                }
            });
            return nextWithObra;
        });
    }, [inferCurrentObraId, syncCollectionChanges]);
    const handleSetUsinaBitu = useCallback((updater) => {
        setUsinaBitu((prev) => {
            const next = normalizeListIds(resolveUpdater(updater, prev));
            const nextWithObra = next.map((row) => {
                if (row?.obraId)
                    return row;
                const obraId = inferCurrentObraId();
                return obraId ? { ...row, obraId } : row;
            });
            void syncCollectionChanges({
                table: 'usina_bituminous_deliveries',
                previous: prev,
                next: nextWithObra,
                toPayload: (row) => {
                    const obraId = inferCurrentObraId();
                    if (!obraId)
                        return null;
                    return {
                        id: row.id,
                        obra_id: row.obraId || obraId,
                        delivery_date: row.date || todayStr(),
                        product: row.product,
                        tons: Number(row.tons || 0),
                        ticket_number: row.ticketNumber || null,
                        plate: row.plate || null,
                        supplier: row.supplier || 'Sem fornecedor',
                        client_updated_at: nowIso()
                    };
                }
            });
            return nextWithObra;
        });
    }, [inferCurrentObraId, syncCollectionChanges]);
    const handleSetUsinaProd = useCallback((updater) => {
        setUsinaProd((prev) => {
            const next = normalizeListIds(resolveUpdater(updater, prev));
            const nextWithObra = next.map((row) => {
                if (row?.obraId)
                    return row;
                const obraId = inferCurrentObraId();
                return obraId ? { ...row, obraId } : row;
            });
            void syncCollectionChanges({
                table: 'usina_daily_production',
                previous: prev,
                next: nextWithObra,
                toPayload: (row) => {
                    const obraId = inferCurrentObraId();
                    if (!obraId)
                        return null;
                    return {
                        id: row.id,
                        obra_id: row.obraId || obraId,
                        production_date: row.date || todayStr(),
                        gross_cbuq: Number(row.grossCbuq || 0),
                        waste: Number(row.waste || 0),
                        net_cbuq: Number(row.netCbuq || 0),
                        cap_consumed: Number(row.capConsumed || 0),
                        brita1_consumed: Number(row.brita1Consumed || 0),
                        brita0_consumed: Number(row.brita0Consumed || 0),
                        stone_dust_consumed: Number(row.stoneDustConsumed || 0),
                        initial_hour_meter: Number(row.initialHourMeter || 0),
                        final_hour_meter: Number(row.finalHourMeter || 0),
                        worked_hours: Number(row.workedHours || 0),
                        client_updated_at: nowIso()
                    };
                }
            });
            return nextWithObra;
        });
    }, [inferCurrentObraId, syncCollectionChanges]);
    const handleSetUsinaLoads = useCallback((updater) => {
        setUsinaLoads((prev) => {
            const next = normalizeListIds(resolveUpdater(updater, prev));
            const nextWithObra = next.map((row) => {
                if (row?.obraId)
                    return row;
                const obraId = inferCurrentObraId();
                return obraId ? { ...row, obraId } : row;
            });
            void syncCollectionChanges({
                table: 'usina_load_entries',
                previous: prev,
                next: nextWithObra,
                toPayload: (row) => {
                    const obraId = inferCurrentObraId();
                    if (!obraId)
                        return null;
                    return {
                        id: row.id,
                        obra_id: row.obraId || obraId,
                        load_date: row.date || todayStr(),
                        plate: row.plate || null,
                        tons: Number(row.tons || 0),
                        temperature: Number(row.temperature || 0),
                        client_updated_at: nowIso()
                    };
                }
            });
            return nextWithObra;
        });
    }, [inferCurrentObraId, syncCollectionChanges]);
    const handleSetBituTankCapacities = useCallback((updater) => {
        setBituTankCapacities((prev) => {
            const next = resolveUpdater(updater, prev);
            const obraId = inferCurrentObraId();
            if (obraId) {
                const payload = Object.entries(next).map(([product, capacity]) => ({
                    obra_id: obraId,
                    product,
                    capacity_tons: Number(capacity || 0),
                    client_updated_at: nowIso()
                }));
                void executeDbAction({
                    type: 'upsert',
                    table: 'usina_tank_capacities',
                    payload,
                    onConflict: 'obra_id,product'
                }, { silentOffline: true });
            }
            return next;
        });
    }, [executeDbAction, inferCurrentObraId]);
    const handleAddBridgeProject = async (project) => {
        const obraId = inferCurrentObraId();
        if (!obraId) {
            addNotification('Cadastre uma obra antes de adicionar projeto de ponte.', 'alert');
            return;
        }
        const item = {
            ...project,
            id: createUuid(),
            obraId,
            status: project.status || 'Em Execucao',
            startDate: project.startDate || todayStr(),
            lastCheckInDate: project.lastCheckInDate || ''
        };
        setBridgeProjects((prev) => [item, ...prev]);
        await executeDbAction({
            type: 'upsert',
            table: 'bridge_projects',
            payload: {
                id: item.id,
                obra_id: obraId,
                name: item.name,
                status: item.status,
                start_date: item.startDate,
                last_check_in_date: item.lastCheckInDate || null,
                client_updated_at: nowIso()
            },
            onConflict: 'id'
        }, { silentOffline: true });
    };
    const handleDeleteBridgeProject = async (projectId) => {
        if (!projectId) {
            return;
        }
        setBridgeProjects((prev) => prev.filter((item) => item.id !== projectId));
        setBridgeMaterials((prev) => prev.filter((item) => item.bridgeProjectId !== projectId));
        setBridgeEmployees((prev) => prev.filter((item) => item.bridgeProjectId !== projectId));
        setBridgeFixedCosts((prev) => prev.filter((item) => item.bridgeProjectId !== projectId));
        setDailyLogs((prev) => prev.filter((item) => item.bridgeProjectId !== projectId));
        const deletedAt = nowIso();
        await executeDbAction({
            type: 'update',
            table: 'bridge_projects',
            payload: { deleted_at: deletedAt, client_updated_at: deletedAt },
            match: { id: projectId }
        }, { silentOffline: true });
        const relatedTables = ['bridge_materials', 'bridge_employees', 'bridge_fixed_costs', 'bridge_daily_logs'];
        for (const table of relatedTables) {
            await executeDbAction({
                type: 'update',
                table,
                payload: { deleted_at: deletedAt, client_updated_at: deletedAt },
                match: { bridge_project_id: projectId }
            }, { silentOffline: true });
        }
        addNotification('Projeto de ponte removido.', 'info');
    };
    const handleAddBridgeMaterial = async (material) => {
        const obraId = inferCurrentObraId();
        if (!obraId)
            return;
        const isEditing = !!material.id;
        const item = {
            ...material,
            id: material.id || createUuid(),
            taxValue: Number(material.taxValue || 0),
            totalValue: (Number(material.quantity || 0) * Number(material.unitPrice || 0)) + Number(material.freightValue || 0) + Number(material.taxValue || 0)
        };
        setBridgeMaterials((prev) => isEditing ? prev.map((entry) => entry.id === item.id ? item : entry) : [item, ...prev]);
        await executeDbAction({
            type: 'upsert',
            table: 'bridge_materials',
            payload: {
                id: item.id,
                obra_id: obraId,
                bridge_project_id: item.bridgeProjectId,
                receipt_date: item.receiptDate,
                emission_date: item.emissionDate || item.receiptDate,
                supplier: item.supplier || null,
                doc_type: item.docType || 'NF',
                doc_number: item.docNumber || null,
                material: item.material,
                quantity: Number(item.quantity || 0),
                unit: item.unit || null,
                unit_price: Number(item.unitPrice || 0),
                freight_value: Number(item.freightValue || 0),
                tax_value: Number(item.taxValue || 0),
                client_updated_at: nowIso()
            },
            onConflict: 'id'
        }, { silentOffline: true });
    };
    const handleUpdateBridgeMaterial = async (material) => {
        await handleAddBridgeMaterial(material);
    };
    const handleDeleteBridgeMaterial = async (id) => {
        setBridgeMaterials((prev) => prev.filter((item) => item.id !== id));
        await executeDbAction({
            type: 'update',
            table: 'bridge_materials',
            payload: { deleted_at: nowIso(), client_updated_at: nowIso() },
            match: { id }
        }, { silentOffline: true });
    };
    const handleAddBridgeEmployee = async (employee) => {
        const obraId = inferCurrentObraId();
        if (!obraId)
            return;
        const item = {
            ...employee,
            id: createUuid(),
            deBaixadaSince: employee.status === 'De Baixada' ? (employee.deBaixadaSince || todayStr()) : null
        };
        setBridgeEmployees((prev) => [item, ...prev]);
        await executeDbAction({
            type: 'upsert',
            table: 'bridge_employees',
            payload: {
                id: item.id,
                obra_id: obraId,
                bridge_project_id: item.bridgeProjectId,
                name: item.name,
                role: item.role,
                salary: Number(item.salary || 0),
                days_worked: Number(item.daysWorked || 0),
                start_date: item.startDate || todayStr(),
                status: item.status || 'Trabalhando',
                breakfast_cost: Number(item.breakfastCost || 0),
                lunch_cost: Number(item.lunchCost || 0),
                dinner_cost: Number(item.dinnerCost || 0),
                total_additional_cost: Number(item.totalAdditionalCost || 0),
                severance_pending: !!item.severancePending,
                termination_date: item.terminationDate || null,
                de_baixada_since: item.deBaixadaSince || null,
                client_updated_at: nowIso()
            },
            onConflict: 'id'
        }, { silentOffline: true });
    };
    const handleDeleteBridgeEmployee = async (id) => {
        setBridgeEmployees((prev) => prev.filter((item) => item.id !== id));
        await executeDbAction({
            type: 'update',
            table: 'bridge_employees',
            payload: { deleted_at: nowIso(), client_updated_at: nowIso() },
            match: { id }
        }, { silentOffline: true });
    };
    const handleUpdateBridgeEmployeeStatus = async (id, status, additionalCost, isPending, statusEffectiveDate) => {
        const target = bridgeEmployees.find((employee) => employee.id === id);
        if (!target)
            return;
        const nextAdditionalCost = Number(target.totalAdditionalCost || 0) + Number(additionalCost || 0);
        const nextTerminationDate = status === 'Demitido' ? (statusEffectiveDate || todayStr()) : target.terminationDate || null;
        const nextDeBaixadaSince = status === 'De Baixada'
            ? (statusEffectiveDate || target.deBaixadaSince || todayStr())
            : (target.status === 'De Baixada' ? null : (target.deBaixadaSince || null));
        setBridgeEmployees((prev) => prev.map((employee) => employee.id === id ? {
            ...employee,
            status,
            totalAdditionalCost: nextAdditionalCost,
            severancePending: !!isPending,
            terminationDate: nextTerminationDate || undefined,
            deBaixadaSince: nextDeBaixadaSince
        } : employee));
        await executeDbAction({
            type: 'update',
            table: 'bridge_employees',
            payload: {
                status,
                total_additional_cost: nextAdditionalCost,
                severance_pending: !!isPending,
                termination_date: nextTerminationDate,
                de_baixada_since: nextDeBaixadaSince,
                client_updated_at: nowIso()
            },
            match: { id }
        }, { silentOffline: true });
    };
    const handleSaveBridgeFixedCosts = async (projectId, costs) => {
        const obraId = inferCurrentObraId();
        if (!obraId)
            return;
        const normalizedCosts = normalizeListIds(costs.map((cost) => ({
            ...cost,
            bridgeProjectId: projectId
        })));
        const previousCosts = bridgeFixedCosts.filter((cost) => cost.bridgeProjectId === projectId);
        setBridgeFixedCosts((prev) => [
            ...prev.filter((cost) => cost.bridgeProjectId !== projectId),
            ...normalizedCosts
        ]);
        await syncCollectionChanges({
            table: 'bridge_fixed_costs',
            previous: previousCosts,
            next: normalizedCosts,
            toPayload: (row) => ({
                id: row.id,
                obra_id: obraId,
                bridge_project_id: projectId,
                description: row.description,
                value: Number(row.value || 0),
                cost_type: row.type || 'Mensal',
                client_updated_at: nowIso()
            })
        });
    };
    const handleSaveBridgeDailyLog = async (log) => {
        const obraId = inferCurrentObraId();
        if (!obraId)
            return;
        const existingLog = log.id ? dailyLogs.find((item) => item.id === log.id) : null;
        const isEditing = !!existingLog;
        const item = {
            ...log,
            id: log.id || createUuid(),
            equipmentList: normalizeListIds((log.equipmentList || []).map((equipment) => ({
                ...equipment,
                id: equipment.id || createUuid()
            })))
        };
        setDailyLogs((prev) => isEditing ? prev.map((entry) => entry.id === item.id ? item : entry) : [item, ...prev]);
        await executeDbAction({
            type: 'upsert',
            table: 'bridge_daily_logs',
            payload: {
                id: item.id,
                obra_id: obraId,
                bridge_project_id: item.bridgeProjectId,
                log_date: item.date || todayStr(),
                weather: item.weather || 'Sol',
                description: item.description || '',
                client_updated_at: nowIso()
            },
            onConflict: 'id'
        }, { silentOffline: true });
        await syncCollectionChanges({
            table: 'bridge_daily_log_equipments',
            previous: normalizeListIds(existingLog?.equipmentList || []),
            next: item.equipmentList || [],
            toPayload: (equipment) => ({
                id: equipment.id,
                obra_id: obraId,
                daily_log_id: item.id,
                equipment_id: machines.find((m) => m.prefix === equipment.prefix)?.id || null,
                prefix: equipment.prefix,
                daily_cost: Number(equipment.dailyCost || 0),
                client_updated_at: nowIso()
            }),
            onConflict: 'id'
        });
    };
    const invokeAdminUsersFunction = useCallback(async (payload) => {
        const supabase = getSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
            throw new Error('Sessao expirada. Faca login novamente.');
        }
        const { data, error } = await supabase.functions.invoke('admin-users', {
            body: payload,
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (error) {
            throw new Error(error.message || 'Falha ao executar função de usuários.');
        }
        if (!data?.ok) {
            throw new Error(data?.error || 'Falha ao processar operação de usuário.');
        }
        return data;
    }, []);
    const handleCreateUserConfig = async (payload) => {
        if (!user?.permissions?.editConfiguracoes) {
            return { error: 'Sem permissão para criar usuários.' };
        }
        setUsersSaving(true);
        try {
            const activeUsers = users.filter((item) => item.isActive !== false).length;
            if (activeUsers >= MAX_ACTIVE_USERS) {
                return { error: `Limite de ${MAX_ACTIVE_USERS} usuários ativos atingido.` };
            }
            await invokeAdminUsersFunction({
                action: 'create',
                email: payload.email,
                password: payload.password,
                name: payload.name,
                username: payload.username || deriveUsernameFromEmail(payload.email),
                role: payload.role,
                allowedObraId: payload.allowedObraId,
                permissions: payload.permissions || {},
                isAdmin: !!payload.isAdmin,
                isActive: payload.isActive !== false
            });
            await fetchUsers();
            addNotification('Usuário criado com sucesso.', 'success');
            return { error: null };
        }
        catch (error) {
            console.error('Erro ao criar usuário:', error);
            return { error: error?.message || 'Falha ao criar usuário.' };
        }
        finally {
            setUsersSaving(false);
        }
    };
    const handleDeleteUserConfig = async (targetUser) => {
        if (!targetUser?.id) {
            return { error: 'Usuário inválido.' };
        }
        if (targetUser.id === user?.id) {
            return { error: 'Não é permitido excluir o próprio usuário.' };
        }
        setUsersSaving(true);
        try {
            await invokeAdminUsersFunction({
                action: 'delete',
                userId: targetUser.id
            });
            await fetchUsers();
            addNotification('Usuário excluído com sucesso.', 'info');
            return { error: null };
        }
        catch (error) {
            console.error('Erro ao excluir usuário:', error);
            return { error: error?.message || 'Falha ao excluir usuário.' };
        }
        finally {
            setUsersSaving(false);
        }
    };
    const handleSaveUserConfig = async (payload, userId) => {
        if (!userId) {
            return { error: 'Crie o login em Authentication > Users (Supabase) e depois configure aqui.' };
        }
        setUsersSaving(true);
        try {
            const supabase = getSupabaseClient();
            const now = new Date().toISOString();
            const targetUser = users.find((item) => item.id === userId);
            const resolvedUsername = payload.username || targetUser?.username || deriveUsernameFromEmail(targetUser?.email || '');
            const profilePayload = {
                id: userId,
                full_name: payload.name,
                username: resolvedUsername,
                role: payload.role,
                allowed_obra_id: payload.allowedObraId === 'all' ? null : payload.allowedObraId,
                client_updated_at: now
            };
            const permissionsPayload = APP_PERMISSION_KEYS.map((permissionKey) => ({
                profile_id: userId,
                permission_key: permissionKey,
                allowed: !!payload.permissions?.[permissionKey],
                client_updated_at: now
            }));
            const [{ error: profileError }, { error: permissionsError }] = await Promise.all([
                supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }),
                supabase.from('profile_permissions').upsert(permissionsPayload, { onConflict: 'profile_id,permission_key' })
            ]);
            if (profileError)
                throw profileError;
            if (permissionsError)
                throw permissionsError;
            await fetchUsers();
            if (user.id === userId) {
                const { data: authData } = await supabase.auth.getUser();
                await loadAuthenticatedUser(authData.user || null);
            }
            addNotification('Usuário atualizado com sucesso.', 'success');
            return { error: null };
        }
        catch (error) {
            console.error('Erro ao salvar configurações do usuário:', error);
            return { error: error?.message || 'Falha ao salvar usuário no Supabase.' };
        }
        finally {
            setUsersSaving(false);
        }
    };
    const handleToggleUserStatus = async (targetUser) => {
        if (!targetUser?.id) {
            return { error: 'Usuário inválido.' };
        }
        if (targetUser.id === user.id && targetUser.isActive) {
            return { error: 'Não é permitido desativar o próprio usuário.' };
        }
        setUsersSaving(true);
        try {
            const supabase = getSupabaseClient();
            const nextStatus = !targetUser.isActive;
            const activeUsers = users.filter((item) => item.isActive !== false).length;
            if (nextStatus && activeUsers >= MAX_ACTIVE_USERS) {
                return { error: `Limite de ${MAX_ACTIVE_USERS} usuários ativos atingido.` };
            }
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: nextStatus, client_updated_at: new Date().toISOString() })
                .eq('id', targetUser.id);
            if (error)
                throw error;
            await fetchUsers();
            addNotification(nextStatus ? 'Usuário ativado.' : 'Usuário desativado.', 'info');
            return { error: null };
        }
        catch (error) {
            console.error('Erro ao alterar status do usuário:', error);
            return { error: error?.message || 'Falha ao atualizar status do usuário.' };
        }
        finally {
            setUsersSaving(false);
        }
    };
    const permissionByView = useCallback((view) => {
        if (view === 'Dashboard')
            return 'editDashboard';
        if (view === 'Em Campo')
            return 'editCampo';
        if (view === 'Abastecimentos')
            return 'editAbastecimentos';
        if (view === 'Oficina')
            return 'editOficina';
        if (view === 'Pontes')
            return 'viewPontes';
        if (view === 'Usina')
            return 'viewUsina';
        if (view === 'Banco de Dados')
            return 'editBancoDados';
        if (view === 'Configuracoes')
            return 'editConfiguracoes';
        return null;
    }, []);
    const canAccessView = useCallback((view) => {
        const permissionKey = permissionByView(view);
        if (!permissionKey)
            return true;
        return !!user?.permissions?.[permissionKey];
    }, [permissionByView, user?.permissions]);
    useEffect(() => {
        if (!user)
            return;
        if (canAccessView(activeView))
            return;
        const fallbackView = ORDERED_VIEWS.find((view) => canAccessView(view)) || 'Dashboard';
        setActiveView(fallbackView);
    }, [activeView, canAccessView, user]);
    const isAllObrasSelected = selectedObraId === 'all';
    const matchesSelectedObra = useCallback((obraId) => {
        if (isAllObrasSelected)
            return true;
        if (!obraId)
            return false;
        return obraId === selectedObraId;
    }, [isAllObrasSelected, selectedObraId]);
    const selectedObraMachines = useMemo(() => machines.filter((machine) => matchesSelectedObra(machine.obraId)), [machines, matchesSelectedObra]);
    const selectedObraWorkers = useMemo(() => workers.filter((worker) => matchesSelectedObra(worker.obraId)), [workers, matchesSelectedObra]);
    const selectedObraMaintenanceTasks = useMemo(() => maintenanceTasks.filter((task) => matchesSelectedObra(task.obraId)), [maintenanceTasks, matchesSelectedObra]);
    const machineObraMap = useMemo(() => {
        const map = new Map();
        machines.forEach((machine) => {
            if (machine?.id && machine?.obraId) {
                map.set(machine.id, machine.obraId);
            }
        });
        return map;
    }, [machines]);
    const selectedObraFuelRecords = useMemo(() => fuelRecords.filter((row) => {
        const linkedMachineObra = row?.machineId && row.machineId !== 'external' ? machineObraMap.get(row.machineId) : null;
        return matchesSelectedObra(row?.obraId || linkedMachineObra || null);
    }), [fuelRecords, machineObraMap, matchesSelectedObra]);
    const selectedObraDieselDeliveries = useMemo(() => dieselDeliveries.filter((row) => matchesSelectedObra(row?.obraId || null)), [dieselDeliveries, matchesSelectedObra]);
    const selectedObraUsinaDeliveries = useMemo(() => usinaDeliveries.filter((row) => matchesSelectedObra(row?.obraId || null)), [usinaDeliveries, matchesSelectedObra]);
    const selectedObraUsinaBitu = useMemo(() => usinaBitu.filter((row) => matchesSelectedObra(row?.obraId || null)), [usinaBitu, matchesSelectedObra]);
    const selectedObraUsinaProd = useMemo(() => usinaProd.filter((row) => matchesSelectedObra(row?.obraId || null)), [usinaProd, matchesSelectedObra]);
    const selectedObraUsinaLoads = useMemo(() => usinaLoads.filter((row) => matchesSelectedObra(row?.obraId || null)), [usinaLoads, matchesSelectedObra]);
    const selectedObraBridgeProjects = useMemo(() => bridgeProjects.filter((project) => matchesSelectedObra(project.obraId)), [bridgeProjects, matchesSelectedObra]);
    const selectedBridgeProjectIds = useMemo(() => new Set(selectedObraBridgeProjects.map((project) => project.id)), [selectedObraBridgeProjects]);
    const selectedObraBridgeMaterials = useMemo(() => bridgeMaterials.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeMaterials, selectedBridgeProjectIds]);
    const selectedObraBridgeEmployees = useMemo(() => bridgeEmployees.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeEmployees, selectedBridgeProjectIds]);
    const selectedObraBridgeFixedCosts = useMemo(() => bridgeFixedCosts.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeFixedCosts, selectedBridgeProjectIds]);
    const selectedObraDailyLogs = useMemo(() => dailyLogs.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [dailyLogs, selectedBridgeProjectIds]);
    const selectedObraBridgeWithdrawals = useMemo(() => bridgeWithdrawals.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeWithdrawals, selectedBridgeProjectIds]);
    const selectedObraBridgeEvents = useMemo(() => bridgeEvents.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeEvents, selectedBridgeProjectIds]);
    const selectedObraBridgeServices = useMemo(() => bridgeServices.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeServices, selectedBridgeProjectIds]);
    const selectedObraBridgeMaterialRequests = useMemo(() => bridgeMaterialRequests.filter((item) => selectedBridgeProjectIds.has(item.bridgeProjectId)), [bridgeMaterialRequests, selectedBridgeProjectIds]);
    const selectedDashboardMachineIds = useMemo(() => {
        if (isAllObrasSelected)
            return dashboardMachineIds;
        const allowedIds = new Set(selectedObraMachines.map((machine) => machine.id));
        return dashboardMachineIds.filter((id) => allowedIds.has(id));
    }, [dashboardMachineIds, isAllObrasSelected, selectedObraMachines]);
    const filteredTankCapacities = useMemo(() => ({ ...bituTankCapacities }), [bituTankCapacities]);
    const selectedDatabaseObras = useMemo(() => (isAllObrasSelected ? obras : obras.filter((obra) => obra.id === selectedObraId)), [isAllObrasSelected, obras, selectedObraId]);
    const workedHoursThisMonth = useMemo(() => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        return selectedObraUsinaProd.reduce((total, row) => {
            if (!row?.date)
                return total;
            const date = new Date(`${row.date}T00:00:00`);
            if (Number.isNaN(date.getTime()))
                return total;
            if (date.getMonth() !== month || date.getFullYear() !== year)
                return total;
            return total + Number(row.workedHours || 0);
        }, 0);
    }, [selectedObraUsinaProd]);
    const totalStoppedHoursForYear = useMemo(() => {
        const year = new Date().getFullYear();
        const toHourDiff = (startDate, startTime, endDate, endTime) => {
            if (!startDate)
                return 0;
            const start = new Date(`${startDate}T${startTime || '00:00'}:00`);
            const end = endDate ? new Date(`${endDate}T${endTime || '00:00'}:00`) : new Date();
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
                return 0;
            return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        };
        return selectedObraMachines.reduce((machineTotal, machine) => {
            const history = machine?.stoppageHistory || [];
            const machineStopped = history.reduce((historyTotal, item) => {
                const yearBase = item?.startDate ? new Date(`${item.startDate}T00:00:00`).getFullYear() : null;
                if (yearBase !== year)
                    return historyTotal;
                return historyTotal + toHourDiff(item.startDate, item.startTime, item.endDate, item.endTime);
            }, 0);
            return machineTotal + machineStopped;
        }, 0);
    }, [selectedObraMachines]);
    if (authLoading)
        return (<div className="min-h-screen bg-brand-primary flex items-center justify-center text-brand-light">
            <p className="text-sm uppercase tracking-widest font-bold text-brand-muted">Carregando sessao...</p>
        </div>);
    if (!user)
        return <LoginView onLogin={handleLogin}/>;
    if (selectedMachineDetail)
        return <MachineDetailView machine={selectedMachineDetail} onBack={() => setSelectedMachineDetail(null)}/>;
    return (<div className="flex h-[100dvh] bg-brand-primary font-sans text-brand-light overflow-hidden">
        <Sidebar activeView={activeView} setActiveView={(v) => setActiveView(v)} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} userPermissions={user.permissions} onLogout={handleLogout}/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} obras={obras} selectedObraId={selectedObraId} onSelectObra={setSelectedObraId} user={user} notifications={notifications} onClearNotifications={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} onNotificationClick={(n) => { }}/>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-brand-primary p-3 sm:p-4 md:p-6">
                {activeView === 'Dashboard' && (<DashboardView machines={selectedObraMachines} machinesWithIssues={selectedObraMachines.filter(m => m.pendingIssues && m.pendingIssues.length > 0)} maintenanceTasks={selectedObraMaintenanceTasks} bridgeMaterials={selectedObraBridgeMaterials} bridgeEmployees={selectedObraBridgeEmployees} bridgeEvents={selectedObraBridgeEvents} bridgeMaterialRequests={selectedObraBridgeMaterialRequests} dailyLogs={selectedObraDailyLogs} bridgeProjects={selectedObraBridgeProjects} usinaDeliveries={selectedObraUsinaDeliveries} usinaBituminous={selectedObraUsinaBitu} usinaProduction={selectedObraUsinaProd} usinaLoads={selectedObraUsinaLoads} fuelRecords={selectedObraFuelRecords} dieselDeliveries={selectedObraDieselDeliveries} notifications={notifications} onAddHorimetro={(m) => { setSelectedMachine(m); setHorimetroModalOpen(true); }} onSelectMachine={setSelectedMachineDetail} onOpenMaintenanceModal={() => setMaintenanceModalOpen(true)} onAddMachineToDashboard={(id) => setDashboardMachineIds(prev => [...prev, id])} onRemoveMachineFromDashboard={(id) => setDashboardMachineIds(prev => prev.filter(x => x !== id))} onUpdateMachineStatus={handleUpdateStatus} availableMachinesToAdd={[]} workedHoursThisMonth={workedHoursThisMonth} totalStoppedHoursForYear={totalStoppedHoursForYear} dashboardMachineIds={selectedDashboardMachineIds} onResolveIssue={handleResolveIssue}/>)}
                {activeView === 'Em Campo' && (<EmCampoView machines={selectedObraMachines} maintenanceTasks={selectedObraMaintenanceTasks} onAddHorimetro={(m) => { setSelectedMachine(m); setHorimetroModalOpen(true); }} onSelectMachine={setSelectedMachineDetail} onAddMachineToDashboard={() => { }} onRemoveMachineFromDashboard={() => { }} onUpdateMachineStatus={handleUpdateStatus} availableMachinesToAdd={[]} dashboardMachineIds={[]}/>)}
                {activeView === 'Abastecimentos' && (<AbastecimentosView machines={selectedObraMachines} maintenanceTasks={selectedObraMaintenanceTasks} records={selectedObraFuelRecords} setRecords={handleSetFuelRecords} dieselDeliveries={selectedObraDieselDeliveries} setDieselDeliveries={handleSetDieselDeliveries} onAddHorimetro={(m) => { setSelectedMachine(m); setHorimetroModalOpen(true); }} onSelectMachine={setSelectedMachineDetail} onUpdateMachineStatus={handleUpdateStatus} onSyncMachineHours={handleSyncMachineHours}/>)}
                {activeView === 'Oficina' && (<OficinaView machines={selectedObraMachines.filter(m => m.status === MachineStatus.Maintenance || m.status === MachineStatus.MechanicalProblem)} allMachines={selectedObraMachines} maintenanceTasks={selectedObraMaintenanceTasks} notifications={notifications} onSelectMachine={setSelectedMachineDetail} onUpdateMachineStatus={handleUpdateStatus} onOpenOficinaEditModal={(m) => { setSelectedMachine(m); setOficinaEditModalOpen(true); }} onResolveIssue={handleResolveIssue} onOpenMaintenanceModal={() => setMaintenanceModalOpen(true)}/>)}
                {activeView === 'Pontes' && (<PontesView currentObraId={selectedObraId} projects={selectedObraBridgeProjects} materials={selectedObraBridgeMaterials} withdrawals={selectedObraBridgeWithdrawals} employees={selectedObraBridgeEmployees} fixedCosts={selectedObraBridgeFixedCosts} events={selectedObraBridgeEvents} services={selectedObraBridgeServices} machines={selectedObraMachines} dailyLogs={selectedObraDailyLogs} workers={selectedObraWorkers} onAddProject={handleAddBridgeProject} onDeleteProject={handleDeleteBridgeProject} onAddMaterial={handleAddBridgeMaterial} onUpdateMaterial={handleUpdateBridgeMaterial} onDeleteMaterial={handleDeleteBridgeMaterial} onAddEmployee={handleAddBridgeEmployee} onEditEmployee={() => { }} onDeleteEmployee={handleDeleteBridgeEmployee} onUpdateEmployeeStatus={handleUpdateBridgeEmployeeStatus} onSaveFixedCosts={handleSaveBridgeFixedCosts} onSaveDailyLog={handleSaveBridgeDailyLog}/>)}
                {activeView === 'Usina' && (<UsinaView machines={selectedObraMachines} deliveries={selectedObraUsinaDeliveries} setDeliveries={handleSetUsinaDeliveries} bituDeliveries={selectedObraUsinaBitu} setBituDeliveries={handleSetUsinaBitu} productionLogs={selectedObraUsinaProd} setProductionLogs={handleSetUsinaProd} loadEntries={selectedObraUsinaLoads} setLoadEntries={handleSetUsinaLoads} tankCapacities={filteredTankCapacities} setTankCapacities={handleSetBituTankCapacities}/>)}
                {activeView === 'Banco de Dados' && (<DatabaseView machines={selectedObraMachines} obras={selectedDatabaseObras} workers={selectedObraWorkers} onAddMachine={() => { setSelectedMachine(null); setMachineModalOpen(true); }} onEditMachine={(m) => { setSelectedMachine(m); setMachineModalOpen(true); }} onDeleteMachine={handleDeleteMachine} onAddWorker={() => { setEditingWorker(null); setWorkerModalOpen(true); }} onEditWorker={(w) => { setEditingWorker(w); setWorkerModalOpen(true); }} onDeleteWorker={handleDeleteWorker} onAddObra={() => { setEditingObra(null); setObraModalOpen(true); }} onEditObra={(o) => { setEditingObra(o); setObraModalOpen(true); }} onDeleteObra={handleDeleteObra}/>)}
                {activeView === 'Configuracoes' && (<ConfiguracoesView users={users} obras={obras} currentUserId={user.id} isLoading={usersLoading} isSaving={usersSaving} onRefreshUsers={fetchUsers} onSaveUser={handleSaveUserConfig} onCreateUser={handleCreateUserConfig} onDeleteUser={handleDeleteUserConfig} onToggleUserStatus={handleToggleUserStatus} notificationSoundEnabled={notificationSoundEnabled} onToggleNotificationSound={setNotificationSoundEnabled}/>)}
            </main>
        </div>
        <HorimetroModal isOpen={horimetroModalOpen} onClose={() => setHorimetroModalOpen(false)} machine={selectedMachine} workers={selectedObraWorkers} onSave={handleSaveHorimetro}/>
        <StatusUpdateModal isOpen={statusUpdateModalOpen} onClose={() => setStatusUpdateModalOpen(false)} machine={selectedMachine} onUpdateStatus={handleUpdateStatus}/>
        <OficinaEditModal isOpen={oficinaEditModalOpen} onClose={() => setOficinaEditModalOpen(false)} machine={selectedMachine} onSave={handleSaveOficinaDetails}/>
        <MaintenanceModal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} machines={selectedObraMachines} onSave={handleSaveMaintenanceTask}/>
        <MachineModal isOpen={machineModalOpen} onClose={() => setMachineModalOpen(false)} onSave={handleSaveMachineData} machineToEdit={selectedMachine} obras={obras} selectedObraId={selectedObraId === 'all' && obras.length > 0 ? obras[0].id : selectedObraId}/>
        <ObraModal isOpen={obraModalOpen} onClose={() => setObraModalOpen(false)} onSave={handleSaveObra} obraToEdit={editingObra}/>
        <OperatorModal isOpen={workerModalOpen} onClose={() => setWorkerModalOpen(false)} onSave={handleSaveWorker} workerToEdit={editingWorker} machines={selectedObraMachines}/>
    </div>);
};
export default App;
