import { requestClient } from '#/api/request';

/**
 * 部门与组织共用 department 表：isCompany=true 的节点是公司（组织），
 * 其余节点通过 companyId 归属公司。增删改统一走 DepartmentApi。
 */
export interface DepartmentNode {
  children?: DepartmentNode[];
  code?: string;
  companyId?: null | number;
  description?: string;
  enabled?: boolean;
  id: number;
  isCompany?: boolean;
  name?: string;
  parentId?: null | number;
  sortOrder?: number;
}

export type DepartmentFormData = Partial<DepartmentNode>;

/** 部门树：POST /department/tree */
export function getDepartmentTree(): Promise<DepartmentNode[]> {
  return requestClient.post<DepartmentNode[]>('/department/tree', {});
}

/** 部门平铺列表：POST /department/list */
export function getDepartmentList(): Promise<DepartmentNode[]> {
  return requestClient.post<DepartmentNode[]>('/department/list', {});
}

/** 新增部门：POST /department/create */
export function createDepartment(
  data: DepartmentFormData,
): Promise<DepartmentNode> {
  return requestClient.post<DepartmentNode>('/department/create', data);
}

/** 编辑部门：POST /department/update */
export function updateDepartment(
  data: DepartmentFormData,
): Promise<DepartmentNode> {
  return requestClient.post<DepartmentNode>('/department/update', data);
}

/**
 * 删除部门：POST /department/delete
 *
 * 后端方法签名是 @RequestBody Long id，请求体必须是「一个数字」而不是对象。
 */
export function deleteDepartment(id: number) {
  return requestClient.post('/department/delete', id);
}

/** 部门详情：POST /department/getDepartmentById，同样传纯数字 */
export function getDepartmentById(id: number): Promise<DepartmentNode> {
  return requestClient.post<DepartmentNode>(
    '/department/getDepartmentById',
    id,
  );
}

/** 部门及其所有子孙 id：POST /department/descendantIds */
export function getDescendantDeptIds(ids: number[]): Promise<number[]> {
  return requestClient.post<number[]>('/department/descendantIds', { ids });
}

/** 部门（含子孙）下的用户 id：POST /department/userIds */
export function getUserIdsByDeptIds(ids: number[]): Promise<number[]> {
  return requestClient.post<number[]>('/department/userIds', { ids });
}

/** 按编码查部门：POST /department/byCode */
export function getDepartmentByCode(code: string): Promise<DepartmentNode> {
  return requestClient.post<DepartmentNode>('/department/byCode', { code });
}
