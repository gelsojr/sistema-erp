import React, { useMemo, useState } from 'react';
import { UsersIcon, PencilIcon, ShieldIcon, BuildingIcon, PlusIcon, TrashIcon } from './icons';

const MAX_USERS = 25;

const EMPTY_PERMISSIONS = {
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

const PERMISSION_OPTIONS = [
    { key: 'editDashboard', label: 'Dashboard' },
    { key: 'editOficina', label: 'Oficina' },
    { key: 'editCampo', label: 'Em Campo' },
    { key: 'editAbastecimentos', label: 'Abastecimentos' },
    { key: 'viewPontes', label: 'Pontes' },
    { key: 'viewUsina', label: 'Usina de Asfalto' },
    { key: 'editBancoDados', label: 'Banco de Dados' },
    { key: 'editConfiguracoes', label: 'Configurações' }
];

const ConfiguracoesView = ({
    users,
    obras,
    currentUserId,
    isLoading,
    isSaving,
    onRefreshUsers,
    onSaveUser,
    onCreateUser,
    onDeleteUser,
    onToggleUserStatus,
    notificationSoundEnabled,
    onToggleNotificationSound
}) => {
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formError, setFormError] = useState('');

    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [allowedObraId, setAllowedObraId] = useState('all');
    const [permissions, setPermissions] = useState({ ...EMPTY_PERMISSIONS });

    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('Operador');
    const [newAllowedObraId, setNewAllowedObraId] = useState('all');
    const [newPermissions, setNewPermissions] = useState({ ...EMPTY_PERMISSIONS });
    const [newIsAdmin, setNewIsAdmin] = useState(false);

    const activeUsersCount = useMemo(() => users.filter((user) => user.isActive !== false).length, [users]);
    const obraMap = useMemo(() => new Map(obras.map((obra) => [obra.id, obra.name])), [obras]);

    const openEditModal = (user) => {
        setFormError('');
        setEditingUser(user);
        setName(user.name || '');
        setRole(user.role || '');
        setAllowedObraId(user.allowedObraId || 'all');
        setPermissions({
            ...EMPTY_PERMISSIONS,
            ...(user.permissions || {})
        });
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditingUser(null);
        setFormError('');
    };

    const openCreateModal = () => {
        setFormError('');
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        setNewRole('Operador');
        setNewAllowedObraId('all');
        setNewPermissions({ ...EMPTY_PERMISSIONS });
        setNewIsAdmin(false);
        setCreateModalOpen(true);
    };

    const closeCreateModal = () => {
        setCreateModalOpen(false);
        setFormError('');
    };

    const handleSaveEdit = async (event) => {
        event.preventDefault();
        if (!editingUser) {
            setFormError('Selecione um usuário existente para editar.');
            return;
        }
        setFormError('');
        const result = await onSaveUser({
            name: name.trim(),
            role: role.trim(),
            allowedObraId,
            permissions
        }, editingUser.id);
        if (result?.error) {
            setFormError(result.error);
            return;
        }
        closeEditModal();
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setFormError('');
        const result = await onCreateUser({
            email: newEmail.trim(),
            password: newPassword,
            name: newName.trim(),
            role: newRole.trim() || 'Operador',
            allowedObraId: newAllowedObraId,
            permissions: newPermissions,
            isAdmin: newIsAdmin,
            isActive: true
        });
        if (result?.error) {
            setFormError(result.error);
            return;
        }
        closeCreateModal();
    };

    const handleStatusToggle = async (targetUser) => {
        setFormError('');
        const actionLabel = targetUser.isActive === false ? 'ativar' : 'desativar';
        if (!window.confirm(`Deseja ${actionLabel} este usuário?`)) {
            return;
        }
        const result = await onToggleUserStatus(targetUser);
        if (result?.error) {
            setFormError(result.error);
        }
    };

    const handleDelete = async (targetUser) => {
        setFormError('');
        if (!window.confirm(`Excluir usuário ${targetUser.name}? Essa ação remove o login.`)) {
            return;
        }
        const result = await onDeleteUser(targetUser);
        if (result?.error) {
            setFormError(result.error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-brand-light flex items-center gap-2">
                            <UsersIcon className="w-6 h-6 text-brand-accent" />
                            Gerenciamento de Usuários
                        </h3>
                        <p className="text-sm text-brand-muted mt-1">
                            CRUD básico de usuários com limite de 25 ativos.
                        </p>
                        <p className="text-xs text-brand-muted mt-1">
                            {activeUsersCount}/{MAX_USERS} usuários ativos.
                        </p>
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-brand-muted cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notificationSoundEnabled !== false}
                                onChange={(event) => onToggleNotificationSound?.(event.target.checked)}
                                className="rounded border-slate-600 text-brand-accent focus:ring-brand-accent bg-brand-secondary"
                            />
                            Som de notificações
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={openCreateModal}
                            disabled={isLoading || isSaving || activeUsersCount >= MAX_USERS}
                            className="font-bold py-2 px-4 rounded-lg transition-colors shadow-md bg-green-600 text-white hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Novo Usuário
                        </button>
                        <button
                            onClick={onRefreshUsers}
                            disabled={isLoading || isSaving}
                            className="font-bold py-2 px-4 rounded-lg transition-colors shadow-md bg-brand-accent text-brand-primary hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sincronizando...' : 'Atualizar Lista'}
                        </button>
                    </div>
                </div>

                {formError && (
                    <div className="mb-4 text-xs font-semibold text-red-300 bg-red-900/30 border border-red-900/50 rounded-md p-3">
                        {formError}
                    </div>
                )}

                <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-lg border border-brand-primary/60">
                    <table className="min-w-full text-sm text-left text-brand-muted">
                        <thead className="bg-brand-primary text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3">Nome</th>
                                <th className="px-4 py-3">Função</th>
                                <th className="px-4 py-3">Email/Login</th>
                                <th className="px-4 py-3">Obra</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Permissões</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => {
                                const obraName = user.allowedObraId && user.allowedObraId !== 'all'
                                    ? obraMap.get(user.allowedObraId) || 'Obra não encontrada'
                                    : 'Todas as Obras';
                                return (
                                    <tr key={user.id} className="border-b border-brand-primary hover:bg-slate-700 transition-colors">
                                        <td className="px-4 py-4 font-medium text-brand-light">{user.name}</td>
                                        <td className="px-4 py-4">{user.role}</td>
                                        <td className="px-4 py-4">{user.username || '-'}</td>
                                        <td className="px-4 py-4">{obraName}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded text-xs ${user.isActive === false
                                                ? 'bg-red-500/20 text-red-300'
                                                : 'bg-green-500/20 text-green-300'}`}>
                                                {user.isActive === false ? 'Inativo' : 'Ativo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex gap-2 flex-wrap">
                                                {PERMISSION_OPTIONS.filter((option) => user.permissions?.[option.key]).map((option) => (
                                                    <span key={option.key} className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-xs">
                                                        {option.label}
                                                    </span>
                                                ))}
                                                {!Object.values(user.permissions || {}).some(Boolean) && (
                                                    <span className="text-xs italic opacity-50">Nenhum acesso</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 flex justify-end items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="p-2 text-blue-400 hover:text-blue-300"
                                                title="Editar"
                                            >
                                                <PencilIcon />
                                            </button>
                                            <button
                                                onClick={() => handleStatusToggle(user)}
                                                disabled={isSaving || (user.id === currentUserId && user.isActive !== false)}
                                                className={`text-xs font-semibold px-3 py-2 rounded ${user.isActive === false
                                                    ? 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
                                                    : 'bg-red-600/20 text-red-300 hover:bg-red-600/30'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {user.isActive === false ? 'Ativar' : 'Desativar'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                disabled={isSaving || user.id === currentUserId}
                                                className="p-2 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Excluir usuário"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!users.length && !isLoading && (
                                <tr>
                                    <td className="px-4 py-6 text-center text-brand-muted" colSpan={7}>
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity p-4">
                    <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                            <h2 className="text-xl font-bold text-brand-light flex items-center gap-2">
                                <PencilIcon className="w-5 h-5" />
                                Editar Usuário
                            </h2>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Função / Cargo</label>
                                    <input
                                        type="text"
                                        value={role}
                                        onChange={(event) => setRole(event.target.value)}
                                        className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Acesso à Obra</label>
                                    <div className="relative">
                                        <select
                                            value={allowedObraId}
                                            onChange={(event) => setAllowedObraId(event.target.value)}
                                            className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 pl-10 focus:ring-2 focus:ring-brand-accent focus:outline-none appearance-none"
                                        >
                                            <option value="all">Todas as Obras</option>
                                            {obras.map((obra) => (
                                                <option key={obra.id} value={obra.id}>
                                                    {obra.name}
                                                </option>
                                            ))}
                                        </select>
                                        <BuildingIcon className="w-5 h-5 text-brand-muted absolute left-3 top-2.5 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h4 className="text-sm font-semibold text-brand-light mb-3 flex items-center gap-2">
                                    <ShieldIcon className="w-4 h-4 text-brand-accent" />
                                    Permissões
                                </h4>
                                <div className="bg-brand-primary p-4 rounded-md border border-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {PERMISSION_OPTIONS.map((permission) => (
                                        <label key={permission.key} className="flex items-center space-x-2 cursor-pointer hover:bg-brand-secondary p-2 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={permissions[permission.key]}
                                                onChange={() => setPermissions((prev) => ({ ...prev, [permission.key]: !prev[permission.key] }))}
                                                className="rounded border-slate-600 text-brand-accent focus:ring-brand-accent bg-brand-secondary"
                                            />
                                            <span className="text-brand-muted text-sm">{permission.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-600">
                                <button
                                    type="button"
                                    onClick={closeEditModal}
                                    className="px-4 py-2 bg-slate-600 text-brand-light rounded-md hover:bg-slate-500 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-brand-accent text-brand-primary font-semibold rounded-md hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity p-4">
                    <div className="bg-brand-secondary rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-600 pb-2">
                            <h2 className="text-xl font-bold text-brand-light flex items-center gap-2">
                                <PlusIcon className="w-5 h-5" />
                                Novo Usuário
                            </h2>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(event) => setNewEmail(event.target.value)}
                                        className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        required
                                    />
                                    <p className="mt-1 text-[11px] text-brand-muted">Obrigatório: login apenas por e-mail.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Senha</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        minLength={6}
                                        className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(event) => setNewName(event.target.value)}
                                        className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Função / Cargo</label>
                                    <input
                                        type="text"
                                        value={newRole}
                                        onChange={(event) => setNewRole(event.target.value)}
                                        className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-muted mb-1">Acesso à Obra</label>
                                    <div className="relative">
                                        <select
                                            value={newAllowedObraId}
                                            onChange={(event) => setNewAllowedObraId(event.target.value)}
                                            className="w-full bg-brand-primary border border-slate-600 text-brand-light rounded-md p-2 pl-10 focus:ring-2 focus:ring-brand-accent focus:outline-none appearance-none"
                                        >
                                            <option value="all">Todas as Obras</option>
                                            {obras.map((obra) => (
                                                <option key={obra.id} value={obra.id}>
                                                    {obra.name}
                                                </option>
                                            ))}
                                        </select>
                                        <BuildingIcon className="w-5 h-5 text-brand-muted absolute left-3 top-2.5 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2">
                                <label className="flex items-center gap-2 text-sm text-brand-muted">
                                    <input
                                        type="checkbox"
                                        checked={newIsAdmin}
                                        onChange={() => setNewIsAdmin((prev) => !prev)}
                                        className="rounded border-slate-600 text-brand-accent focus:ring-brand-accent bg-brand-secondary"
                                    />
                                    Usuário administrador
                                </label>
                            </div>

                            <div className="mt-6">
                                <h4 className="text-sm font-semibold text-brand-light mb-3 flex items-center gap-2">
                                    <ShieldIcon className="w-4 h-4 text-brand-accent" />
                                    Permissões
                                </h4>
                                <div className="bg-brand-primary p-4 rounded-md border border-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {PERMISSION_OPTIONS.map((permission) => (
                                        <label key={permission.key} className="flex items-center space-x-2 cursor-pointer hover:bg-brand-secondary p-2 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={newPermissions[permission.key]}
                                                onChange={() => setNewPermissions((prev) => ({ ...prev, [permission.key]: !prev[permission.key] }))}
                                                className="rounded border-slate-600 text-brand-accent focus:ring-brand-accent bg-brand-secondary"
                                            />
                                            <span className="text-brand-muted text-sm">{permission.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-600">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    className="px-4 py-2 bg-slate-600 text-brand-light rounded-md hover:bg-slate-500 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? 'Criando...' : 'Criar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfiguracoesView;
