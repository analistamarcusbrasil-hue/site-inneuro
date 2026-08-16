import type { AdminProfile } from "@/types/cms";

export const adminPermissions = [
  "publications.view",
  "publications.edit",
  "publications.publish",
  "hr.view",
  "hr.manage",
  "scheduling.view",
  "scheduling.manage",
  "contact.view",
  "contact.manage",
  "users.manage",
  "audit.view",
  "settings.manage",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];
export type AccessProfile =
  | "super_admin"
  | "manager"
  | "reception"
  | "hr"
  | "publications"
  | "attendance"
  | "custom";

export const permissionLabels: Record<AdminPermission, string> = {
  "publications.view": "Visualizar",
  "publications.edit": "Editar",
  "publications.publish": "Publicar",
  "hr.view": "Visualizar",
  "hr.manage": "Gerenciar",
  "scheduling.view": "Visualizar",
  "scheduling.manage": "Gerenciar",
  "contact.view": "Visualizar",
  "contact.manage": "Gerenciar",
  "users.manage": "Gerenciar usuários",
  "audit.view": "Consultar auditoria",
  "settings.manage": "Gerenciar configurações",
};

export const accessProfileLabels: Record<AccessProfile, string> = {
  super_admin: "Superadministrador",
  manager: "Gestor",
  reception: "Recepção",
  hr: "RH",
  publications: "Publicações",
  attendance: "Atendimento",
  custom: "Personalizado",
};

export const permissionsByAccessProfile: Record<
  AccessProfile,
  readonly AdminPermission[]
> = {
  super_admin: adminPermissions,
  manager: [
    "publications.view",
    "publications.edit",
    "publications.publish",
    "hr.view",
    "hr.manage",
    "scheduling.view",
    "scheduling.manage",
    "contact.view",
    "contact.manage",
  ],
  reception: ["scheduling.view", "scheduling.manage"],
  hr: ["hr.view", "hr.manage"],
  publications: [
    "publications.view",
    "publications.edit",
    "publications.publish",
  ],
  attendance: ["contact.view", "contact.manage"],
  custom: [],
};

export const permissionGroups = [
  {
    key: "publications",
    label: "Publicações",
    permissions: [
      "publications.view",
      "publications.edit",
      "publications.publish",
    ],
  },
  {
    key: "hr",
    label: "RH",
    permissions: ["hr.view", "hr.manage"],
  },
  {
    key: "scheduling",
    label: "Agendamentos",
    permissions: ["scheduling.view", "scheduling.manage"],
  },
  {
    key: "contact",
    label: "Fale Conosco",
    permissions: ["contact.view", "contact.manage"],
  },
  {
    key: "administration",
    label: "Administração",
    permissions: ["users.manage", "audit.view", "settings.manage"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  permissions: readonly AdminPermission[];
}[];

function legacyPermissions(profile: AdminProfile): readonly AdminPermission[] {
  if (profile.role === "super_admin") return adminPermissions;
  if (profile.role === "admin") {
    return [...permissionsByAccessProfile.manager, "settings.manage"];
  }
  if (profile.role === "reception") return permissionsByAccessProfile.reception;
  if (profile.hr_role) return ["hr.view", "hr.manage"];
  return ["publications.view", "publications.edit"];
}

export function effectivePermissions(
  profile: AdminProfile | null | undefined,
): readonly AdminPermission[] {
  if (!profile?.active) return [];
  if (
    profile.role === "super_admin" ||
    profile.access_profile === "super_admin"
  )
    return adminPermissions;
  if (Array.isArray(profile.permissions)) return profile.permissions;
  return legacyPermissions(profile);
}

export function hasAdminPermission(
  profile: AdminProfile | null | undefined,
  permission: AdminPermission,
) {
  return effectivePermissions(profile).includes(permission);
}

export function permissionsForProfile(profile: AccessProfile) {
  return [...permissionsByAccessProfile[profile]];
}

export function permissionsToModuleLabels(
  permissions: readonly AdminPermission[],
) {
  return permissionGroups
    .filter((group) =>
      group.permissions.some((permission) => permissions.includes(permission)),
    )
    .map((group) => group.label);
}
