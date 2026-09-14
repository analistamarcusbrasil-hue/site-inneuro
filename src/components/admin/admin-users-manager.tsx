"use client";

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  adminUserCommandAction,
  createAdminUserAction,
  resetAdminUserPasswordAction,
  updateAdminUserAction,
} from "@/app/admin/actions";
import {
  AdminBadge,
  AdminButton,
  AdminDialog,
  AdminDrawer,
  AdminEmptyState,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableContainer,
  AdminTableHead,
  AdminTableHeader,
  AdminTableRow,
} from "@/components/admin/ui";
import {
  accessProfileLabels,
  permissionGroups,
  permissionLabels,
  permissionsForProfile,
  permissionsToModuleLabels,
  type AccessProfile,
  type AdminPermission,
} from "@/lib/admin/permissions";

export type AdminUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  access_profile: AccessProfile | null;
  permissions: AdminPermission[] | null;
  active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  last_updated_at: string;
  last_updated_by: string;
};

type UserFilter =
  | "all"
  | "active"
  | "inactive"
  | "reception"
  | "hr"
  | "publications"
  | "attendance"
  | "manager";
type SortKey = "user" | "email" | "status" | "profile" | "updated";
type SortDirection = "asc" | "desc";
type ConfirmCommand = "deactivate" | "delete";

const profiles = Object.keys(accessProfileLabels) as AccessProfile[];
const filters: { value: UserFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "reception", label: "Recepção" },
  { value: "hr", label: "RH" },
  { value: "publications", label: "Publicações" },
  { value: "attendance", label: "Atendimento" },
  { value: "manager", label: "Gestores" },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function accessProfileForUser(user: AdminUserRow): AccessProfile {
  return (
    user.access_profile ??
    (user.role === "super_admin"
      ? "super_admin"
      : user.role === "reception"
        ? "reception"
        : "custom")
  );
}

function permissionsForUser(user: AdminUserRow) {
  const profile = accessProfileForUser(user);
  return user.permissions ?? permissionsForProfile(profile);
}

function initials(name: string | null) {
  const parts = (name ?? "U").trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "U"}${parts.length > 1 ? parts.at(-1)?.[0] : ""}`.toLocaleUpperCase(
    "pt-BR",
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function UserAvatar({ user }: { user: AdminUserRow }) {
  return (
    <span
      className="bg-mint text-brand grid size-10 shrink-0 place-items-center rounded-full text-xs font-extrabold"
      aria-hidden="true"
    >
      {initials(user.full_name)}
    </span>
  );
}

function PermissionBadges({ user }: { user: AdminUserRow }) {
  const modules = permissionsToModuleLabels(permissionsForUser(user));
  const visible = modules.slice(0, 3);
  const remaining = modules.length - visible.length;
  const allPermissions = modules.length ? modules.join(", ") : "Sem acessos";
  return (
    <div className="flex max-w-72 flex-wrap gap-1.5" title={allPermissions}>
      {visible.length ? (
        visible.map((module) => (
          <AdminBadge
            key={module}
            variant="neutral"
            className="whitespace-nowrap"
          >
            {module}
          </AdminBadge>
        ))
      ) : (
        <span className="text-muted text-xs">Sem acessos</span>
      )}
      {remaining > 0 ? (
        <AdminBadge
          variant="info"
          aria-label={`Mais ${remaining} áreas. ${allPermissions}`}
        >
          +{remaining}
        </AdminBadge>
      ) : null}
    </div>
  );
}

function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  disabled = false,
  title,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "outline" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <AdminButton
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      title={title}
      className={className}
    >
      {pending ? pendingLabel : children}
    </AdminButton>
  );
}

function PermissionFields({
  selected,
  onChange,
  allowAdministrative,
}: {
  selected: readonly AdminPermission[];
  onChange: (permissions: AdminPermission[]) => void;
  allowAdministrative: boolean;
}) {
  const toggle = (permission: AdminPermission) => {
    const dependencies: Partial<Record<AdminPermission, AdminPermission[]>> = {
      "publications.edit": ["publications.view"],
      "publications.publish": ["publications.view", "publications.edit"],
      "hr.evaluate": ["hr.view"],
      "hr.manage": ["hr.view", "hr.evaluate"],
      "scheduling.manage": ["scheduling.view"],
      "contact.manage": ["contact.view"],
    };
    const dependents: Partial<Record<AdminPermission, AdminPermission[]>> = {
      "publications.view": ["publications.edit", "publications.publish"],
      "publications.edit": ["publications.publish"],
      "hr.view": ["hr.evaluate", "hr.manage"],
      "hr.evaluate": ["hr.manage"],
      "scheduling.view": ["scheduling.manage"],
      "contact.view": ["contact.manage"],
    };
    if (selected.includes(permission)) {
      const removed = new Set([permission, ...(dependents[permission] ?? [])]);
      onChange(selected.filter((item) => !removed.has(item)));
      return;
    }
    onChange([
      ...new Set([
        ...selected,
        ...(dependencies[permission] ?? []),
        permission,
      ]),
    ]);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {permissionGroups
        .filter(
          (group) => group.key !== "administration" || allowAdministrative,
        )
        .map((group) => (
          <details
            key={group.key}
            className="border-border-light rounded-2xl border p-4"
            open={group.key !== "administration"}
          >
            <summary className="cursor-pointer font-bold">
              {group.label}
            </summary>
            <div className="mt-3 space-y-2">
              {group.permissions.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission}
                    checked={selected.includes(permission)}
                    onChange={() => toggle(permission)}
                    className="size-4 accent-[#087a4d]"
                  />
                  {permissionLabels[permission]}
                </label>
              ))}
            </div>
          </details>
        ))}
      <input type="hidden" name="permissions_customized" value="true" />
    </div>
  );
}

function ProfileSelect({
  value,
  onChange,
}: {
  value: AccessProfile;
  onChange: (profile: AccessProfile) => void;
}) {
  return (
    <label className="block text-sm font-bold">
      Perfil
      <select
        name="access_profile"
        value={value}
        onChange={(event) => onChange(event.target.value as AccessProfile)}
        className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
      >
        {profiles.map((profile) => (
          <option key={profile} value={profile}>
            {accessProfileLabels[profile]}
          </option>
        ))}
      </select>
    </label>
  );
}

function CreateUserDialog({ close }: { close: () => void }) {
  const [profile, setProfile] = useState<AccessProfile>("reception");
  const [permissions, setPermissions] = useState<AdminPermission[]>(
    permissionsForProfile("reception"),
  );
  const changeProfile = (next: AccessProfile) => {
    setProfile(next);
    setPermissions(permissionsForProfile(next));
  };
  return (
    <AdminDrawer
      onClose={close}
      labelledBy="new-user-title"
      describedBy="new-user-description"
      className="max-w-2xl"
    >
      <section className="min-h-full p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-brand text-xs font-bold tracking-widest uppercase">
              Novo acesso
            </p>
            <h2
              id="new-user-title"
              className="font-heading text-brand-dark mt-2 text-2xl font-semibold"
            >
              Criar usuário
            </h2>
            <p id="new-user-description" className="text-muted mt-2 text-sm">
              Cadastre a conta e libere apenas as áreas necessárias.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="border-border-light grid size-11 place-items-center rounded-xl border"
            aria-label="Fechar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form action={createAdminUserAction} className="mt-7 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold sm:col-span-2">
              Nome completo
              <input
                name="full_name"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold sm:col-span-2">
              E-mail
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold">
              Senha inicial
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold">
              Confirmar senha
              <input
                name="password_confirmation"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <ProfileSelect value={profile} onChange={changeProfile} />
            <label className="block text-sm font-bold">
              Status
              <select
                name="active"
                defaultValue="active"
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>
          <label className="bg-surface flex items-center gap-3 rounded-xl p-4 text-sm font-bold">
            <input
              name="must_change_password"
              type="checkbox"
              defaultChecked
              className="size-4 accent-[#087a4d]"
            />
            Exigir alteração da senha no primeiro acesso
          </label>
          <div>
            <h3 className="font-heading text-lg font-semibold">Acessos</h3>
            <p className="text-muted mt-1 text-sm">
              O perfil preenche as opções. Você pode personalizar antes de
              criar.
            </p>
          </div>
          <PermissionFields
            selected={permissions}
            onChange={setPermissions}
            allowAdministrative={profile === "super_admin"}
          />
          <SubmitButton pendingLabel="Criando usuário…" className="w-full">
            Criar usuário
          </SubmitButton>
        </form>
      </section>
    </AdminDrawer>
  );
}

function UserEditor({
  user,
  close,
}: {
  user: AdminUserRow;
  close: () => void;
}) {
  const initialProfile = accessProfileForUser(user);
  const [profile, setProfile] = useState<AccessProfile>(initialProfile);
  const [permissions, setPermissions] = useState<AdminPermission[]>(
    permissionsForUser(user),
  );
  const changeProfile = (next: AccessProfile) => {
    setProfile(next);
    setPermissions(permissionsForProfile(next));
  };
  return (
    <AdminDrawer
      onClose={close}
      labelledBy="edit-user-title"
      describedBy="edit-user-description"
      className="max-w-2xl"
    >
      <section className="min-h-full p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-brand text-xs font-bold tracking-widest uppercase">
              Usuário e acessos
            </p>
            <h2
              id="edit-user-title"
              className="font-heading text-brand-dark mt-2 text-2xl font-semibold"
            >
              Editar {user.full_name || "usuário"}
            </h2>
            <p id="edit-user-description" className="text-muted mt-2 text-sm">
              Atualize o perfil e as permissões deste acesso administrativo.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="border-border-light grid size-11 place-items-center rounded-xl border"
            aria-label="Fechar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form action={updateAdminUserAction} className="mt-7 space-y-5">
          <input type="hidden" name="id" value={user.id} />
          <input
            type="hidden"
            name="expected_updated_at"
            value={user.updated_at}
          />
          <input
            type="hidden"
            name="active"
            value={user.active ? "active" : "inactive"}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold sm:col-span-2">
              Nome completo
              <input
                name="full_name"
                defaultValue={user.full_name ?? ""}
                required
                minLength={2}
                maxLength={120}
                className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <ProfileSelect value={profile} onChange={changeProfile} />
          </div>
          <PermissionFields
            selected={permissions}
            onChange={setPermissions}
            allowAdministrative={profile === "super_admin"}
          />
          <SubmitButton pendingLabel="Salvando alterações…">
            Salvar alterações
          </SubmitButton>
        </form>
        <details className="border-warning/30 mt-6 rounded-xl border p-4">
          <summary className="text-warning cursor-pointer text-sm font-bold">
            Redefinir senha
          </summary>
          <form
            action={resetAdminUserPasswordAction}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="id" value={user.id} />
            <input
              name="password"
              type="password"
              minLength={8}
              required
              placeholder="Nova senha temporária"
              aria-label="Nova senha temporária"
              autoComplete="new-password"
              className="border-border-light min-h-11 rounded-xl border px-3"
            />
            <input
              name="password_confirmation"
              type="password"
              minLength={8}
              required
              placeholder="Confirmar senha"
              aria-label="Confirmar senha temporária"
              autoComplete="new-password"
              className="border-border-light min-h-11 rounded-xl border px-3"
            />
            <SubmitButton
              pendingLabel="Redefinindo senha…"
              variant="outline"
              className="text-warning border-warning sm:col-span-2"
            >
              Redefinir e exigir troca no próximo acesso
            </SubmitButton>
          </form>
        </details>
      </section>
    </AdminDrawer>
  );
}

function UserCommandFields({
  user,
  command,
}: {
  user: AdminUserRow;
  command: "activate" | ConfirmCommand;
}) {
  return (
    <>
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="command" value={command} />
      <input type="hidden" name="expected_updated_at" value={user.updated_at} />
    </>
  );
}

function UserActions({
  user,
  self,
  lastActiveSuperAdmin,
  onEdit,
  onConfirm,
  mobile = false,
}: {
  user: AdminUserRow;
  self: boolean;
  lastActiveSuperAdmin: boolean;
  onEdit: () => void;
  onConfirm: (command: ConfirmCommand) => void;
  mobile?: boolean;
}) {
  const protectedAction = self || lastActiveSuperAdmin;
  const layout = mobile
    ? "grid w-full gap-2"
    : "flex items-center justify-end gap-2";
  const buttonWidth = mobile ? "w-full justify-start" : "whitespace-nowrap";
  return (
    <div className={layout}>
      <AdminButton
        variant="ghost"
        size="sm"
        onClick={onEdit}
        disabled={self}
        className={buttonWidth}
        title={
          self ? "Sua própria conta não pode ser editada aqui." : undefined
        }
      >
        <Pencil size={15} aria-hidden="true" /> Editar
      </AdminButton>
      <form action={adminUserCommandAction}>
        <UserCommandFields user={user} command="activate" />
        <SubmitButton
          pendingLabel="Ativando…"
          variant="outline"
          size="sm"
          disabled={user.active || self}
          title={
            self
              ? "Sua própria conta não pode ser alterada aqui."
              : user.active
                ? "O usuário já está ativo."
                : undefined
          }
          className={`border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ${buttonWidth}`}
        >
          <UserCheck size={15} aria-hidden="true" /> Ativar usuário
        </SubmitButton>
      </form>
      <AdminButton
        variant="outline"
        size="sm"
        onClick={() => onConfirm("deactivate")}
        disabled={!user.active || protectedAction}
        className={`border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 ${buttonWidth}`}
        title={
          protectedAction
            ? "Esta conta está protegida contra desativação."
            : !user.active
              ? "O usuário já está inativo."
              : undefined
        }
      >
        <UserX size={15} aria-hidden="true" /> Desativar usuário
      </AdminButton>
      <AdminButton
        variant="outline"
        size="sm"
        onClick={() => onConfirm("delete")}
        disabled={protectedAction}
        className={`border-red-200 bg-red-50 text-red-700 hover:bg-red-100 ${buttonWidth}`}
        title={
          protectedAction
            ? "Esta conta está protegida contra exclusão."
            : undefined
        }
      >
        <Trash2 size={15} aria-hidden="true" /> Excluir usuário
      </AdminButton>
    </div>
  );
}

function ConfirmUserCommandDialog({
  user,
  command,
  close,
}: {
  user: AdminUserRow;
  command: ConfirmCommand;
  close: () => void;
}) {
  const deleting = command === "delete";
  const profile = accessProfileForUser(user);
  return (
    <AdminDialog
      title={
        deleting ? "Excluir usuário permanentemente?" : "Desativar usuário?"
      }
      description={
        deleting
          ? "Esta ação removerá o acesso deste usuário da operação e não poderá ser desfeita pela interface."
          : "O usuário perderá o acesso ao sistema até que seja ativado novamente."
      }
      onClose={close}
    >
      {deleting ? (
        <dl className="border-border-light bg-surface grid gap-3 rounded-xl border p-4 text-sm">
          <div>
            <dt className="text-muted text-xs font-bold uppercase">Nome</dt>
            <dd className="mt-1 font-bold">{user.full_name || "Sem nome"}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs font-bold uppercase">E-mail</dt>
            <dd className="mt-1 break-all">{user.email || "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs font-bold uppercase">Perfil</dt>
            <dd className="mt-1">{accessProfileLabels[profile]}</dd>
          </div>
        </dl>
      ) : null}
      <form
        action={adminUserCommandAction}
        className="mt-5 flex justify-end gap-3"
      >
        <UserCommandFields user={user} command={command} />
        <AdminButton type="button" variant="outline" onClick={close}>
          Cancelar
        </AdminButton>
        <SubmitButton
          pendingLabel={deleting ? "Excluindo…" : "Desativando…"}
          variant="danger"
        >
          {deleting ? "Excluir usuário" : "Desativar usuário"}
        </SubmitButton>
      </form>
    </AdminDialog>
  );
}

function SortButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (column: SortKey) => void;
}) {
  const active = sortKey === column;
  const Icon = !active
    ? ChevronsUpDown
    : sortDirection === "asc"
      ? ChevronUp
      : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="hover:text-brand-dark inline-flex items-center gap-1"
      aria-label={`Ordenar por ${label}`}
    >
      {label}
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

function UserCard({
  user,
  currentUserId,
  lastActiveSuperAdmin,
  onEdit,
  onConfirm,
}: {
  user: AdminUserRow;
  currentUserId: string;
  lastActiveSuperAdmin: boolean;
  onEdit: () => void;
  onConfirm: (command: ConfirmCommand) => void;
}) {
  const profile = accessProfileForUser(user);
  const self = user.id === currentUserId;
  return (
    <article className="border-border-light rounded-2xl border bg-white p-4">
      <div className="flex items-start gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <h2 className="text-brand-dark truncate font-bold">
            {user.full_name || "Sem nome"}
          </h2>
          <p className="text-muted mt-1 truncate text-sm">
            {user.email || "E-mail não registrado"}
          </p>
        </div>
        <AdminBadge variant={user.active ? "success" : "danger"}>
          {user.active ? "Ativo" : "Inativo"}
        </AdminBadge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted text-xs font-bold uppercase">Perfil</dt>
          <dd className="mt-1 font-bold">{accessProfileLabels[profile]}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs font-bold uppercase">
            Última atualização
          </dt>
          <dd className="mt-1">{formatDateTime(user.last_updated_at)}</dd>
          <dd className="text-muted text-xs">por {user.last_updated_by}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <PermissionBadges user={user} />
      </div>
      <details className="border-border-light mt-4 rounded-xl border">
        <summary className="text-brand cursor-pointer list-none px-4 py-3 text-sm font-bold">
          Ações
        </summary>
        <div className="border-border-light border-t p-3">
          <UserActions
            user={user}
            self={self}
            lastActiveSuperAdmin={lastActiveSuperAdmin}
            onEdit={onEdit}
            onConfirm={onConfirm}
            mobile
          />
        </div>
      </details>
    </article>
  );
}

export function AdminUsersManager({
  users,
  currentUserId,
  loadError = false,
  feedback,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  loadError?: boolean;
  feedback?: { type: "success" | "error"; message: string };
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [confirming, setConfirming] = useState<{
    user: AdminUserRow;
    command: ConfirmCommand;
  } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFeedback, setShowFeedback] = useState(Boolean(feedback));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setShowFeedback(false), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query);
    return users.filter((user) => {
      const profile = accessProfileForUser(user);
      const modules = permissionsToModuleLabels(permissionsForUser(user));
      const searchable = normalize(
        [
          user.full_name ?? "",
          user.email ?? "",
          accessProfileLabels[profile],
          ...modules,
        ].join(" "),
      );
      if (normalizedQuery && !searchable.includes(normalizedQuery))
        return false;
      if (filter === "active" && !user.active) return false;
      if (filter === "inactive" && user.active) return false;
      if (!["all", "active", "inactive"].includes(filter) && profile !== filter)
        return false;
      return true;
    });
  }, [filter, query, users]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((left, right) => {
        const leftProfile = accessProfileForUser(left);
        const rightProfile = accessProfileForUser(right);
        const values: Record<SortKey, [string | number, string | number]> = {
          user: [left.full_name ?? "", right.full_name ?? ""],
          email: [left.email ?? "", right.email ?? ""],
          status: [Number(left.active), Number(right.active)],
          profile: [
            accessProfileLabels[leftProfile],
            accessProfileLabels[rightProfile],
          ],
          updated: [
            new Date(left.last_updated_at).getTime(),
            new Date(right.last_updated_at).getTime(),
          ],
        };
        const [a, b] = values[sortKey];
        const result =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b), "pt-BR", {
                sensitivity: "base",
              });
        return sortDirection === "asc" ? result : -result;
      }),
    [filtered, sortDirection, sortKey],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = sorted.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(safePage * pageSize, sorted.length);
  const activeSuperAdminCount = users.filter(
    (user) => user.active && accessProfileForUser(user) === "super_admin",
  ).length;
  const isLastActiveSuperAdmin = (user: AdminUserRow) =>
    user.active &&
    accessProfileForUser(user) === "super_admin" &&
    activeSuperAdminCount <= 1;
  const sort = (column: SortKey) => {
    setPage(1);
    if (sortKey === column)
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(column);
      setSortDirection("asc");
    }
  };

  if (loadError)
    return (
      <AdminEmptyState
        title="Não foi possível carregar os usuários."
        description="Tente novamente. Se o problema continuar, verifique a configuração segura do servidor."
        action={
          <AdminButton onClick={() => window.location.reload()}>
            Tentar novamente
          </AdminButton>
        }
      />
    );

  return (
    <>
      {showFeedback && feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`fixed right-4 bottom-4 z-[100] flex max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-xl ${feedback.type === "error" ? "border-red-200 text-red-800" : "border-emerald-200 text-emerald-800"}`}
        >
          <p className="text-sm font-bold">{feedback.message}</p>
          <button
            type="button"
            onClick={() => setShowFeedback(false)}
            className="grid size-7 shrink-0 place-items-center rounded-lg"
            aria-label="Fechar aviso"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative min-w-0 flex-1 lg:max-w-xl">
          <span className="sr-only">Buscar por nome, e-mail ou perfil</span>
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
            size={18}
            aria-hidden="true"
          />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="border-border-light min-h-11 w-full rounded-xl border bg-white pr-4 pl-11"
          />
        </label>
        <AdminButton onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" />
          Novo usuário
        </AdminButton>
      </div>
      <div
        className="mb-5 flex gap-2 overflow-x-auto pb-1"
        aria-label="Filtros de usuários"
      >
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setFilter(item.value);
              setPage(1);
            }}
            aria-pressed={filter === item.value}
            className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${filter === item.value ? "bg-brand text-white" : "border-border-light text-brand hover:bg-mint/50 border bg-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {!users.length ? (
        <AdminEmptyState
          title="Nenhum usuário cadastrado."
          description="Crie o primeiro acesso administrativo para começar."
          action={
            <AdminButton onClick={() => setCreating(true)}>
              <Plus size={18} aria-hidden="true" />
              Novo usuário
            </AdminButton>
          }
        />
      ) : !sorted.length ? (
        <AdminEmptyState
          title="Nenhum usuário encontrado para esta pesquisa."
          description="Ajuste a busca ou selecione outro filtro."
          action={
            <AdminButton
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setQuery("");
                setFilter("all");
              }}
            >
              Limpar filtros
            </AdminButton>
          }
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <AdminTableContainer>
              <AdminTable className="min-w-[86rem]">
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead>
                      <SortButton
                        label="Usuário"
                        column="user"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={sort}
                      />
                    </AdminTableHead>
                    <AdminTableHead>
                      <SortButton
                        label="E-mail"
                        column="email"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={sort}
                      />
                    </AdminTableHead>
                    <AdminTableHead>Áreas / permissões</AdminTableHead>
                    <AdminTableHead>
                      <SortButton
                        label="Status"
                        column="status"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={sort}
                      />
                    </AdminTableHead>
                    <AdminTableHead>
                      <SortButton
                        label="Perfil"
                        column="profile"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={sort}
                      />
                    </AdminTableHead>
                    <AdminTableHead>
                      <SortButton
                        label="Última atualização"
                        column="updated"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={sort}
                      />
                    </AdminTableHead>
                    <AdminTableHead className="bg-surface sticky right-0 z-10 text-right shadow-[-10px_0_18px_-18px_rgba(3,37,27,.55)]">
                      Ações
                    </AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {pageRows.map((user) => {
                    const profile = accessProfileForUser(user);
                    const self = user.id === currentUserId;
                    return (
                      <AdminTableRow key={user.id}>
                        <AdminTableCell>
                          <div className="flex min-w-48 items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <strong className="text-brand-dark block truncate">
                                {user.full_name || "Sem nome"}
                              </strong>
                              <span className="text-muted mt-0.5 block text-xs">
                                {accessProfileLabels[profile]}
                              </span>
                            </div>
                          </div>
                        </AdminTableCell>
                        <AdminTableCell className="max-w-56 truncate">
                          {user.email || "E-mail não registrado"}
                        </AdminTableCell>
                        <AdminTableCell>
                          <PermissionBadges user={user} />
                        </AdminTableCell>
                        <AdminTableCell>
                          <AdminBadge
                            variant={user.active ? "success" : "danger"}
                          >
                            {user.active ? "Ativo" : "Inativo"}
                          </AdminBadge>
                        </AdminTableCell>
                        <AdminTableCell className="font-bold">
                          {accessProfileLabels[profile]}
                        </AdminTableCell>
                        <AdminTableCell className="whitespace-nowrap">
                          <time dateTime={user.last_updated_at}>
                            {formatDateTime(user.last_updated_at)}
                          </time>
                          <span className="text-muted mt-1 block text-xs">
                            por {user.last_updated_by}
                          </span>
                        </AdminTableCell>
                        <AdminTableCell className="sticky right-0 bg-white shadow-[-10px_0_18px_-18px_rgba(3,37,27,.55)]">
                          <UserActions
                            user={user}
                            self={self}
                            lastActiveSuperAdmin={isLastActiveSuperAdmin(user)}
                            onEdit={() => setEditing(user)}
                            onConfirm={(command) =>
                              setConfirming({ user, command })
                            }
                          />
                        </AdminTableCell>
                      </AdminTableRow>
                    );
                  })}
                </AdminTableBody>
              </AdminTable>
            </AdminTableContainer>
          </div>
          <div className="grid gap-3 xl:hidden">
            {pageRows.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                currentUserId={currentUserId}
                lastActiveSuperAdmin={isLastActiveSuperAdmin(user)}
                onEdit={() => setEditing(user)}
                onConfirm={(command) => setConfirming({ user, command })}
              />
            ))}
          </div>
          <div className="border-border-light mt-4 flex flex-col gap-4 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted text-sm">
              Mostrando {rangeStart} a {rangeEnd} de {sorted.length} usuários
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="border-border-light min-h-10 rounded-lg border bg-white px-3 text-sm"
                aria-label="Usuários por página"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </select>
              <nav
                className="flex items-center gap-1"
                aria-label="Paginação de usuários"
              >
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  aria-label="Página anterior"
                >
                  ‹
                </AdminButton>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter(
                    (number) =>
                      number === 1 ||
                      number === totalPages ||
                      Math.abs(number - safePage) <= 1,
                  )
                  .map((number, index, visiblePages) => (
                    <span key={number} className="contents">
                      {index > 0 && number - visiblePages[index - 1] > 1 ? (
                        <span className="text-muted px-1" aria-hidden="true">
                          …
                        </span>
                      ) : null}
                      <AdminButton
                        variant={number === safePage ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setPage(number)}
                        aria-current={number === safePage ? "page" : undefined}
                        aria-label={`Página ${number}`}
                      >
                        {number}
                      </AdminButton>
                    </span>
                  ))}
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={safePage >= totalPages}
                  aria-label="Próxima página"
                >
                  ›
                </AdminButton>
              </nav>
            </div>
          </div>
        </>
      )}
      {creating ? <CreateUserDialog close={() => setCreating(false)} /> : null}
      {editing ? (
        <UserEditor user={editing} close={() => setEditing(null)} />
      ) : null}
      {confirming ? (
        <ConfirmUserCommandDialog
          user={confirming.user}
          command={confirming.command}
          close={() => setConfirming(null)}
        />
      ) : null}
    </>
  );
}
