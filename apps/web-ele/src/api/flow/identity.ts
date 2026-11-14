import type {
  FlowAssigneePreviewReq,
  FlowIdentityNodeVO,
  FlowIdentityPageVO,
  FlowIdentityQueryReq,
  FlowIdentityVO,
} from './types';

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
export function getFlowUserIdsByRoleIds(roleIds: string[]): Promise<string[]> {
  return requestClient.post<string[]>(`${BASE}/usersByRoleIds`, { roleIds });
}

/** 按部门反查用户 Id（含子孙部门） */
export function getFlowUserIdsByDeptIds(deptIds: number[]): Promise<string[]> {
  return requestClient.post<string[]>(`${BASE}/usersByDeptIds`, { deptIds });
}

/** 分页用户查询：关键字 + 部门 + 角色过滤（选人弹窗的数据源）。 */
export function getFlowUserPage(
  params: FlowIdentityQueryReq,
): Promise<FlowIdentityPageVO> {
  return requestClient.post<FlowIdentityPageVO>(`${BASE}/userPage`, params);
}

/** 部门树（选人弹窗左侧）。 */
export function getFlowDeptTree(): Promise<FlowIdentityNodeVO[]> {
  return requestClient.post<FlowIdentityNodeVO[]>(`${BASE}/deptTree`, {});
}

/** 组织树（公司 + 部门）。 */
export function getFlowOrgTree(): Promise<FlowIdentityNodeVO[]> {
  return requestClient.post<FlowIdentityNodeVO[]>(`${BASE}/orgTree`, {});
}

/**
 * 审批人场景预览：用与运行时相同的解析器算出该场景最终分给哪些用户。
 * 数据来自 oidc-server（经 workflow-server 的 OpenFeign 调用）。
 */
export function previewFlowAssignees(
  data: FlowAssigneePreviewReq,
): Promise<FlowIdentityVO[]> {
  return requestClient.post<FlowIdentityVO[]>(`${BASE}/previewAssignees`, data);
}
