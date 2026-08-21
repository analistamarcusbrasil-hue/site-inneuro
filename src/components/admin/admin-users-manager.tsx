"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  createAdminUserAction,
  resetAdminUserPasswordAction,
  updateAdminUserAction,
} from "@/app/admin/actions";
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
};

const profiles = Object.keys(accessProfileLabels) as AccessProfile[];

function friendlyLastAccess(value: string | null) {
  if (!value) return "Nunca acessou";
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Hoje ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
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
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-user-title"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={close}
        className="absolute inset-0"
      />
      <section className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
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
          </div>
          <button
            type="button"
            onClick={close}
            className="grid size-11 place-items-center rounded-full border"
            aria-label="Fechar"
          >
            <X />
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
          <label className="flex items-center gap-3 rounded-xl bg-[#f3f8f5] p-4 text-sm font-bold">
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
          <button className="bg-brand min-h-12 w-full rounded-full px-6 font-bold text-white">
            Criar usuário
          </button>
        </form>
      </section>
    </div>
  );
}

function UserEditor({
  user,
  currentUserId,
}: {
  user: AdminUserRow;
  currentUserId: string;
}) {
  const initialProfile =
    user.access_profile ??
    (user.role === "super_admin"
      ? "super_admin"
      : user.role === "reception"
        ? "reception"
        : "custom");
  const [profile, setProfile] = useState<AccessProfile>(initialProfile);
  const [permissions, setPermissions] = useState<AdminPermission[]>(
    user.permissions ?? permissionsForProfile(initialProfile),
  );
  const changeProfile = (next: AccessProfile) => {
    setProfile(next);
    setPermissions(permissionsForProfile(next));
  };
  const self = user.id === currentUserId;
  return (
    <details className="border-border-light rounded-2xl border bg-white">
      <summary className="text-brand cursor-pointer list-none p-4 text-sm font-bold">
        Editar
      </summary>
      <div className="border-border-light border-t p-4">
        {self ? (
          <p className="bg-mint text-brand rounded-xl p-3 text-sm font-bold">
            Por segurança, sua própria conta não pode alterar perfil, permissões
            ou status nesta tela.
          </p>
        ) : (
          <form action={updateAdminUserAction} className="space-y-5">
            <input type="hidden" name="id" value={user.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold">
                Nome completo
                <input
                  name="full_name"
                  defaultValue={user.full_name ?? ""}
                  required
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
                />
              </label>
              <ProfileSelect value={profile} onChange={changeProfile} />
              <label className="block text-sm font-bold">
                Status
                <select
                  name="active"
                  defaultValue={user.active ? "active" : "inactive"}
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>
            <PermissionFields
              selected={permissions}
              onChange={setPermissions}
              allowAdministrative={profile === "super_admin"}
            />
            <button className="bg-brand min-h-11 rounded-full px-5 text-sm font-bold text-white">
              Salvar alterações
            </button>
          </form>
        )}
        {!self ? (
          <details className="border-warning/30 mt-5 rounded-xl border p-4">
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
                autoComplete="new-password"
                className="border-border-light min-h-11 rounded-xl border px-3"
              />
              <input
                name="password_confirmation"
                type="password"
                minLength={8}
                required
                placeholder="Confirmar senha"
                autoComplete="new-password"
                className="border-border-light min-h-11 rounded-xl border px-3"
              />
              <button className="border-warning text-warning min-h-11 rounded-full border px-4 text-sm font-bold sm:col-span-2">
                Redefinir e exigir troca no próximo acesso
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </details>
  );
}

export function AdminUsersManager({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const text =
          `${user.full_name ?? ""} ${user.email ?? ""}`.toLocaleLowerCase(
            "pt-BR",
          );
        if (!text.includes(query.toLocaleLowerCase("pt-BR"))) return false;
        if (filter === "active" && !user.active) return false;
        if (filter === "inactive" && user.active) return false;
        if (
          !["all", "active", "inactive"].includes(filter) &&
          user.access_profile !== filter
        )
          return false;
        return true;
      }),
    [filter, query, users],
  );
  const filters = [
    ["all", "Todos"],
    ["active", "Ativos"],
    ["inactive", "Inativos"],
    ["reception", "Recepção"],
    ["hr", "RH"],
    ["publications", "Publicações"],
    ["attendance", "Atendimento"],
    ["manager", "Gestores"],
  ];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="text-muted absolute top-1/2 left-4 -translate-y-1/2"
            size={18}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="border-border-light min-h-12 w-full rounded-full border bg-white pr-4 pl-11"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="bg-brand flex min-h-12 items-center gap-2 rounded-full px-5 font-bold text-white"
        >
          <Plus size={18} />
          Novo usuário
        </button>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`min-h-9 rounded-full px-4 text-xs font-bold ${filter === value ? "bg-brand text-white" : "border-border-light text-brand border bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((user) => {
          const profile =
            user.access_profile ??
            (user.role === "super_admin"
              ? "super_admin"
              : user.role === "reception"
                ? "reception"
                : "custom");
          const modules = permissionsToModuleLabels(
            user.permissions ?? permissionsForProfile(profile),
          );
          return (
            <article
              key={user.id}
              className="border-border-light rounded-3xl border bg-white p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1.3fr_1fr_1.5fr_.7fr_1fr_auto] lg:items-center">
                <div>
                  <h2 className="font-heading font-semibold">
                    {user.full_name || "Sem nome"}
                  </h2>
                </div>
                <p className="text-muted min-w-0 truncate text-sm">
                  {user.email || "E-mail não registrado"}
                </p>
                <p className="text-sm font-bold">
                  {accessProfileLabels[profile]}
                </p>
                <p className="text-muted text-sm">
                  {modules.length ? modules.join(" · ") : "Sem acessos"}
                </p>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${user.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                >
                  {user.active ? "Ativo" : "Inativo"}
                </span>
                <p className="text-muted text-xs">
                  {friendlyLastAccess(user.last_login_at)}
                </p>
                <UserEditor user={user} currentUserId={currentUserId} />
              </div>
            </article>
          );
        })}
        {!filtered.length ? (
          <p className="border-border-light text-muted rounded-2xl border border-dashed bg-white p-6">
            Nenhum usuário encontrado.
          </p>
        ) : null}
      </div>
      {creating ? <CreateUserDialog close={() => setCreating(false)} /> : null}
    </>
  );
}
