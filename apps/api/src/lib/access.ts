export function hasPrivilegedRole(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("head");
}

export function canAccessOwnedEntity(
  ownerUserId: number | null | undefined,
  currentUser: { userId: number; roles: string[] }
): boolean {
  if (hasPrivilegedRole(currentUser.roles)) {
    return true;
  }

  return ownerUserId === currentUser.userId;
}
