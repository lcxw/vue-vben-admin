import { requestClient } from '#/api/request';

/**
 * 后端 PermissionVO。
 *
 * 菜单与权限点共用 permission 表：
 * type='0' 菜单 / '1' iframe / '2' 外链 / '3' 按钮（权限点）。
 */
export interface PermissionNode {
  children?: PermissionNode[];
  code?: string;
  component?: string;
  createId?: string;
  createTime?: string;
  description?: string;
  enabled?: boolean;
  icon?: string;
  id: string;
  menuType?: number;
  name?: string;
  openType?: string;
  parentId?: string;
  path?: string;
  sortable?: number;
  type?: string;
  updateId?: string;
  updateTime?: string;
  view?: string;
}

export type PermissionFormData = Partial<PermissionNode>;

/**
 * 后端 permission 表的 type 是历史字符串：'MENU' / 'BUTTON'（配合 open_type='_iframe'
 * 或外链 URL），而管理页面内部统一用 '0'=菜单 / '1'=内嵌 / '2'=外链 / '3'=按钮。
 *
 * 这里在 API 层做双向转换，页面逻辑不需要兼容两套编码；写入时也保持与存量数据一致
 * 的大写字符串，避免库里混进 '0'/'3' 导致 SystemQueryService.isMenu() 判断失真。
 */
export function normalizePermissionNode(node: PermissionNode): PermissionNode {
  const rawType = (node.type ?? '').toUpperCase();
  const openType = node.openType ?? '';
  let type = node.type;
  if (rawType === 'BUTTON' || node.type === '3') {
    type = '3';
  } else if (
    rawType === 'MENU' ||
    node.type === '0' ||
    node.type === undefined
  ) {
    if (openType === '_iframe' || node.view) {
      type = '1';
    } else if (/^https?:\/\//i.test(openType)) {
      type = '2';
    } else {
      type = '0';
    }
  }
  return {
    ...node,
    children: node.children?.map((child) => normalizePermissionNode(child)),
    type,
  };
}

/** 管理页内部 type → 后端库里的 type / menu_type / open_type */
function toBackendPermission(data: PermissionFormData): PermissionFormData {
  const isButton = data.type === '3';
  return {
    ...data,
    menuType: isButton ? 3 : 0,
    openType: data.type === '1' ? '_iframe' : (data.openType ?? undefined),
    type: isButton ? 'BUTTON' : 'MENU',
  };
}

/** 全量权限树（含按钮）：POST /permission/permissionTree */
export async function getPermissionTree(): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>(
    '/permission/permissionTree',
    {},
  );
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 全量权限平铺列表（含按钮）：POST /permission/list */
export async function getPermissionList(): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>(
    '/permission/list',
    {},
  );
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 权限详情：POST /permission/getPermissionById */
export async function getPermissionById(id: string): Promise<PermissionNode> {
  const node = await requestClient.post<PermissionNode>(
    '/permission/getPermissionById',
    { id },
  );
  return normalizePermissionNode(node);
}

/** 新增菜单/权限点：POST /permission/create */
export function createPermission(data: PermissionFormData) {
  return requestClient.post('/permission/create', toBackendPermission(data));
}

/** 编辑菜单/权限点：POST /permission/update */
export function updatePermission(data: PermissionFormData) {
  return requestClient.post('/permission/update', toBackendPermission(data));
}

/** 删除菜单/权限点：POST /permission/delete（有下级时后端会拒绝） */
export function deletePermission(id: string) {
  return requestClient.post('/permission/delete', { id });
}

/** 角色已绑定的权限点：POST /permission/rolePermissions */
export async function getRolePermissionNodes(
  roleId: string,
): Promise<PermissionNode[]> {
  const list = await requestClient.post<PermissionNode[]>(
    '/permission/rolePermissions',
    { id: roleId },
  );
  return (list ?? []).map((child) => normalizePermissionNode(child));
}

/** 当前登录用户权限码：GET /permission/userCodes */
export function getCurrentUserCodes(): Promise<string[]> {
  return requestClient.get<string[]>('/permission/userCodes');
}

/** 指定用户权限码：POST /user/permissionCodes 已放到 user.ts，这里保留角色版 */
export function getPermissionCodesByRole(roleId: string): Promise<string[]> {
  return requestClient.post<string[]>('/permission/roleCodes', { id: roleId });
}
