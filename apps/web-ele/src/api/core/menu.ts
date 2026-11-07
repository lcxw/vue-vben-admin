import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

import { transformMenuTree } from './menu-transformer';

/**
 * 获取用户所有菜单
 *
 * 后端端点：GET /menu/all
 * 后端返回 PermissionVO 树（由 system-server MenuController /menu/user/tree 提供）
 * 前端通过 menu-transformer 转换为 RouteRecordStringComponent 树
 */
export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const raw = await requestClient.get<any[]>('/menu/all');
  return transformMenuTree(raw ?? []);
}
