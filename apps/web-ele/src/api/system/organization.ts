import type { DepartmentNode } from './department';
import type { DeptPostNode } from './post';
import type { SystemUser } from './user';

import { requestClient } from '#/api/request';

/** 组织架构树（公司节点 + 其下部门）：POST /organization/tree */
export function getOrganizationTree(): Promise<DepartmentNode[]> {
  return requestClient.post<DepartmentNode[]>('/organization/tree', {});
}

/** 公司（组织）列表：POST /organization/list */
export function getOrganizationList(): Promise<DepartmentNode[]> {
  return requestClient.post<DepartmentNode[]>('/organization/list', {});
}

/** 按公司 id 查其下部门（平铺）：POST /organization/departments */
export function getDepartmentsByCompanyIds(
  ids: number[],
): Promise<DepartmentNode[]> {
  return requestClient.post<DepartmentNode[]>('/organization/departments', {
    ids,
  });
}

/** 按公司 id 查其下全部部门 id：POST /organization/departmentIds */
export function getDepartmentIdsByCompanyIds(ids: number[]): Promise<number[]> {
  return requestClient.post<number[]>('/organization/departmentIds', { ids });
}

/** 按公司 id 查其下全部用户：POST /organization/users */
export function getUsersByCompanyIds(ids: number[]): Promise<SystemUser[]> {
  return requestClient.post<SystemUser[]>('/organization/users', { ids });
}

/** 按公司编码查组织：POST /organization/byCode */
export function getOrganizationByCode(code: string): Promise<DepartmentNode> {
  return requestClient.post<DepartmentNode>('/organization/byCode', { code });
}

/** 按部门 id 查部门-岗位关联：POST /organization/deptPosts */
export function getDeptPostsByDeptIds(ids: number[]): Promise<DeptPostNode[]> {
  return requestClient.post<DeptPostNode[]>('/organization/deptPosts', { ids });
}
