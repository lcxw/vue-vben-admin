import type { PermissionNode } from './permission';

import { requestClient } from '#/api/request';

import { normalizePermissionNode } from './permission';

/**
 * 菜单视图接口。后端 MenuApi 只暴露「菜单」部分（已排除 BUTTON），
 * 菜单的增删改仍统一走 PermissionApi（/permission/*）。
 *
 * 与 permission.ts 一样，这里把库里的 'MENU'/'BUTTON' 归一成页面内部 '0'..'3'。
 */

/** 全量菜单树：POST /menu/tree */
export async function getMenuTree(): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>('/menu/tree', {});
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 全量菜单平铺列表：POST /menu/list */
export async function getMenuList(): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>('/menu/list', {});
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 指定用户可见菜单树：POST /menu/user/tree */
export async function getUserMenuTree(
  userId: number | string,
): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>('/menu/user/tree', {
    userId: Number(userId),
  });
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 指定角色已绑定菜单树：POST /menu/role/tree */
export async function getRoleMenuTree(
  roleId: string,
): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>('/menu/role/tree', {
    id: roleId,
  });
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 指定用户可见菜单权限码：POST /menu/user/codes */
export function getUserMenuCodes(userId: number | string): Promise<string[]> {
  return requestClient.post<string[]>('/menu/user/codes', {
    userId: Number(userId),
  });
}

/** 按编码查菜单：POST /menu/byCode */
export async function getMenuByCode(code: string): Promise<PermissionNode> {
  const node = await requestClient.post<PermissionNode>('/menu/byCode', {
    code,
  });
  return normalizePermissionNode(node);
}
