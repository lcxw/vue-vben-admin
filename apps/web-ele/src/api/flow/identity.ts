import type { FlowIdentityVO } from './types';

import { requestClient } from '#/api/request';

const BASE = '/flow/identity';

/** 用户列表（keyword 可选，本地/后端模糊匹配） */
export function getFlowUsers(keyword?: string): Promise<FlowIdentityVO[]> {
  return requestClient.post<FlowIdentityVO[]>(`${BASE}/users`, { keyword });
}

/** 按用户 Id 批量反查（属性面板回显用） */
export function getFlowUsersByIds(ids: string[]): Promise<FlowIdentityVO[]> {
  return requestClient.post<FlowIdentityVO[]>(`${BASE}/usersByIds`, { ids });
}

export function getFlowRoles(keyword?: string): Promise<FlowIdentityVO[]> {
  return requestClient.post<FlowIdentityVO[]>(`${BASE}/roles`, { keyword });
}

export function getFlowDepts(): Promise<FlowIdentityVO[]> {
  return requestClient.post<FlowIdentityVO[]>(`${BASE}/depts`, {});
}

export function getFlowPosts(): Promise<FlowIdentityVO[]> {
  return requestClient.post<FlowIdentityVO[]>(`${BASE}/posts`, {});
}

/** 按角色反查用户 Id（运行时按角色找人） */
export function getFlowUserIdsByRoleIds(
  roleIds: string[],
): Promise<string[]> {
  return requestClient.post<string[]>(`${BASE}/usersByRoleIds`, { roleIds });
}

/** 按部门反查用户 Id（含子孙部门） */
export function getFlowUserIdsByDeptIds(
  deptIds: number[],
): Promise<string[]> {
  return requestClient.post<string[]>(`${BASE}/usersByDeptIds`, { deptIds });
}
