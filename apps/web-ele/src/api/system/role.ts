import type { PermissionNode } from './permission';
import type { BackendPage, GridPage, PageQuery } from './types';

import { requestClient } from '#/api/request';

import { toGridPage } from './types';

/** 后端 RoleVO */
export interface SystemRole {
  code?: string;
  createId?: string;
  createTime?: string;
  description?: string;
  enabled?: boolean;
  id: string;
  name?: string;
  permissions?: string[];
  updateId?: string;
  updateTime?: string;
}

/** 后端 RoleQuery */
export interface RolePageQuery extends PageQuery {
  code?: string;
  enable?: string;
  name?: string;
  userId?: string;
  username?: string;
}

export type RoleFormData = Partial<SystemRole>;

/** 角色分页：POST /role/page */
export async function getRolePage(
  params: RolePageQuery,
): Promise<GridPage<SystemRole>> {
  const page = await requestClient.post<BackendPage<SystemRole>>(
    '/role/page',
    params,
  );
  return toGridPage(page);
}

/** 全量角色列表（下拉/勾选用）：POST /role/roleList */
export function getAllRoles(filter: RoleFormData = {}): Promise<SystemRole[]> {
  return requestClient.post<SystemRole[]>('/role/roleList', filter);
}

/** 新增角色：POST /role/add */
export function createRole(data: RoleFormData) {
  return requestClient.post('/role/add', data);
}

/** 编辑角色：POST /role/edit */
export function updateRole(data: RoleFormData) {
  return requestClient.post('/role/edit', data);
}

/** 删除角色：POST /role/system/role/remove/{roleId} */
export function deleteRole(roleId: string) {
  return requestClient.post(`/role/system/role/remove/${roleId}`);
}

/** 角色已绑定的权限点：POST /role/permissions */
export function getRolePermissions(roleId: string): Promise<PermissionNode[]> {
  return requestClient.post<PermissionNode[]>('/role/permissions', {
    id: roleId,
  });
}

/** 角色已绑定的权限 id：POST /role/permissionIds */
export function getRolePermissionIds(roleId: string): Promise<string[]> {
  return requestClient.post<string[]>('/role/permissionIds', { id: roleId });
}

/**
 * 绑定角色权限（全量替换）：POST /permission/bindPermissions
 *
 * 权限点是 permission 表的数据，绑定端点在 PermissionController 上。
 */
export function bindRolePermissions(roleId: string, permissionIds: string[]) {
  return requestClient.post('/permission/bindPermissions', {
    permissionIds,
    roleId,
  });
}

/** 角色已绑定用户 id：POST /role/roleUserIds */
export function getRoleUserIds(roleId: string): Promise<string[]> {
  return requestClient.post<string[]>('/role/roleUserIds', { id: roleId });
}

/** 绑定角色用户（全量替换）：POST /role/bindUsers */
export function bindRoleUsers(roleId: string, userIds: string[]) {
  return requestClient.post('/role/bindUsers', { roleId, userIds });
}

/** 角色已绑定的权限码：POST /permission/roleCodes */
export function getRolePermissionCodes(roleId: string): Promise<string[]> {
  return requestClient.post<string[]>('/permission/roleCodes', { id: roleId });
}
