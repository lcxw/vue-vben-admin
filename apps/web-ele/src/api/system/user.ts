import type { BackendPage, GridPage, PageQuery } from './types';

import { requestClient } from '#/api/request';

import { toGridPage } from './types';

/** 后端 UserInfoVO */
export interface SystemUser {
  avatarUrl?: string;
  dataScope?: number;
  departmentId?: null | number;
  email?: string;
  enabled?: boolean;
  gender?: number;
  nickName?: string;
  phoneNumber?: string;
  realName?: string;
  userId: string;
  username?: string;
  userType?: number;
}

/** 后端 UserPageQuery（enable/gender 是字符串，注意不要传布尔） */
export interface UserPageQuery extends PageQuery {
  deptId?: null | number;
  deptIdList?: number[];
  enable?: string;
  gender?: string;
  roleId?: null | number;
  roleIdList?: number[];
  username?: string;
}

/** 后端 UserDetailVO = UserInfoVO + 关联 id 集合 */
export interface UserDetail extends SystemUser {
  deptPostIds?: number[];
  roleIds?: string[];
}

/** 用户新增/编辑提交体（后端 add 收 UserInfoVO、edit 收 UserInfo 实体） */
export type UserFormData = Partial<SystemUser> & {
  password?: string;
};

/** 用户分页列表：POST /user/users */
export async function getUserPage(
  params: UserPageQuery,
): Promise<GridPage<SystemUser>> {
  const page = await requestClient.post<BackendPage<SystemUser>>(
    '/user/users',
    params,
  );
  return toGridPage(page);
}

/** 全量用户列表（下拉选择器用）：POST /user/userList */
export function getAllUsers(keyword?: string): Promise<SystemUser[]> {
  return requestClient.post<SystemUser[]>('/user/userList', {
    username: keyword ?? '',
  });
}

/** 按 id 集合批量查用户：POST /user/byIds（部门筛选时使用） */
export function getUsersByIds(ids: number[]): Promise<SystemUser[]> {
  return requestClient.post<SystemUser[]>('/user/byIds', { ids });
}

/** 新增用户：POST /user/add */
export function createUser(data: UserFormData) {
  return requestClient.post('/user/add', data);
}

/**
 * 编辑用户：POST /user/system/user/edit
 *
 * 注意：这是 Controller 自有端点（类级 user + 方法级 /system/user/edit），
 * 不是 /system/user/edit；后端会强制把 username 置空以避免改账号。
 */
export function updateUser(data: UserFormData) {
  return requestClient.post('/user/system/user/edit', data);
}

/** 删除单个用户：POST /user/system/user/remove/{userId} */
export function deleteUser(userId: number | string) {
  return requestClient.post(`/user/system/user/remove/${userId}`);
}

/** 批量删除用户：POST /user/deleteBatch */
export function deleteUsersBatch(userIds: number[]) {
  return requestClient.post('/user/deleteBatch', { userIds });
}

/** 重置密码为默认密码：POST /user/resetPassword */
export function resetUserPassword(userId: number | string) {
  return requestClient.post('/user/resetPassword', { userId: Number(userId) });
}

/** 修改自己的密码：POST /user/password */
export function changePassword(data: {
  confirmPassword: string;
  newPassword: string;
  oldPassword: string;
  userId?: number;
}) {
  return requestClient.post('/user/password', data);
}

/** 用户详情：POST /user/getUserDetail */
export function getUserDetail(userId: number | string): Promise<UserDetail> {
  return requestClient.post<UserDetail>('/user/getUserDetail', {
    userId: Number(userId),
  });
}

/** 用户已绑定角色 id：POST /user/roleIds */
export function getUserRoleIds(userId: number | string): Promise<string[]> {
  return requestClient.post<string[]>('/user/roleIds', {
    userId: Number(userId),
  });
}

/** 绑定用户角色（全量替换）：POST /user/system/user/save/roles */
export function bindUserRoles(userId: number | string, roleIds: string[]) {
  return requestClient.post('/user/system/user/save/roles', {
    roleIds,
    userId: String(userId),
  });
}

/** 用户已绑定部门岗位 id：POST /user/userPosts */
export function getUserPostIds(userId: number | string): Promise<number[]> {
  return requestClient.post<number[]>('/user/userPosts', {
    userId: Number(userId),
  });
}

/** 绑定用户部门岗位：POST /user/bindPosts */
export function bindUserPosts(userId: number | string, deptPostIds: number[]) {
  return requestClient.post('/user/bindPosts', {
    deptPostIds,
    userId: Number(userId),
  });
}

/** 用户自定义数据权限部门 id：POST /user/dataDeptIds */
export function getUserDataDeptIds(userId: number | string): Promise<number[]> {
  return requestClient.post<number[]>('/user/dataDeptIds', {
    userId: Number(userId),
  });
}

/** 绑定用户自定义数据权限部门：POST /user/bindDataDepts */
export function bindUserDataDepts(userId: number | string, deptIds: number[]) {
  return requestClient.post('/user/bindDataDepts', {
    deptIds,
    userId: Number(userId),
  });
}

/** 用户聚合后的权限码：POST /user/permissionCodes */
export function getUserPermissionCodes(
  userId: number | string,
): Promise<string[]> {
  return requestClient.post<string[]>('/user/permissionCodes', {
    userId: Number(userId),
  });
}
