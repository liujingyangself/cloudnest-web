export enum UserRole {
  GENERAL,
  GUEST,
  ADMIN,
}

// A role row from /admin/role/list. Since v3.46.0 a user's `role` holds role
// ids from this table, not the UserRole constants above: those only line up by
// coincidence for the seeded guest (1) and admin (2) roles.
export interface Role {
  id: number
  name: string
  description: string
  default: boolean
}

export interface User {
  id: number
  username: string
  password: string
  base_path: string
  // number only for records predating the multi-role migration
  role: UserRole | number[]
  permission: number
  sso_id: string
  disabled: boolean
  // Absolute account deadline (RFC3339); null means the account never expires.
  expires_at: string | null
  // openid under the WeChat mini program; empty when WeChat isn't bound
  wx_mini_openid?: string
  // otp: boolean;
}

export const UserPermissions = [
  "see_hides",
  "access_without_password",
  "offline_download",
  "write",
  "rename",
  "move",
  "copy",
  "delete",
  "webdav_read",
  "webdav_manage",
] as const

const hasRole = (user: User, role: UserRole): boolean => {
  if (Array.isArray(user.role)) {
    return user.role.includes(role)
  }
  return user.role === role
}

export const UserMethods = {
  is_guest: (user: User) => hasRole(user, UserRole.GUEST),
  is_admin: (user: User) => hasRole(user, UserRole.ADMIN),
  is_general: (user: User) => hasRole(user, UserRole.GENERAL),
  can: (user: User, permission: number) =>
    UserMethods.is_admin(user) || ((user.permission >> permission) & 1) == 1,
  // can_see_hides: (user: User) =>
  //   UserMethods.is_admin(user) || (user.permission & 1) == 1,
  // can_access_without_password: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 1) & 1) == 1,
  // can_offline_download_tasks: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 2) & 1) == 1,
  // can_write: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 3) & 1) == 1,
  // can_rename: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 4) & 1) == 1,
  // can_move: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 5) & 1) == 1,
  // can_copy: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 6) & 1) == 1,
  // can_remove: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 7) & 1) == 1,
  // can_webdav_read: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 8) & 1) == 1,
  // can_webdav_manage: (user: User) =>
  //   UserMethods.is_admin(user) || ((user.permission >> 9) & 1) == 1,
}
