import type { BackendPage, GridPage, PageQuery } from './types';

import { requestClient } from '#/api/request';

import { toGridPage } from './types';

/** 在线用户 */
export interface LoginUserItem {
  expiresAt?: string;
  loginName?: string;
  loginTime?: string;
  sessionId?: string;
}

/** 在线用户查询 */
export interface LoginUserQuery extends PageQuery {
  loginName?: string;
  sessionId?: string;
}

/** 操作日志 */
export interface OperationLogItem {
  apiClass?: string;
  apiMethod?: string;
  description?: string;
  elapse?: number;
  errorMsg?: string;
  logId?: number;
  operationTime?: string;
  operationType?: number;
  operatorId?: string;
  operatorName?: string;
  requestArguments?: string;
  requestIp?: string;
  requestMethod?: string;
  requestUrl?: string;
  responseResult?: string;
  serviceName?: string;
  success?: boolean;
  traceId?: string;
}

/** 操作日志查询 */
export interface OperationLogQuery extends PageQuery {
  description?: string;
  operationTimeEnd?: string;
  operationTimeStart?: string;
  operationType?: number;
  operatorName?: string;
  success?: boolean;
}

/** 在线用户分页：POST /system/loginUser/page */
export async function getLoginUserPage(
  params: LoginUserQuery,
): Promise<GridPage<LoginUserItem>> {
  const page = await requestClient.post<BackendPage<LoginUserItem>>(
    '/system/loginUser/page',
    params,
  );
  return toGridPage(page);
}

/** 强制下线：POST /system/loginUser/delete */
export function forceLogout(sessionId: string) {
  return requestClient.post('/system/loginUser/delete', { sessionId });
}

/** 操作日志分页：POST /system/operationLog/page */
export async function getOperationLogPage(
  params: OperationLogQuery,
): Promise<GridPage<OperationLogItem>> {
  const page = await requestClient.post<BackendPage<OperationLogItem>>(
    '/system/operationLog/page',
    params,
  );
  return toGridPage(page);
}

/** 权限白名单 */
export interface PermWhitelistItem {
  [key: string]: unknown;
  id?: string;
  path?: string;
  remark?: string;
}

/** 白名单列表：POST /system/permWhitelist/list */
export function getPermWhitelist(
  params: Record<string, unknown> = {},
): Promise<PermWhitelistItem[]> {
  return requestClient.post<PermWhitelistItem[]>(
    '/system/permWhitelist/list',
    params,
  );
}

/** 新增白名单：POST /system/permWhitelist/add */
export function addPermWhitelist(data: Record<string, unknown>) {
  return requestClient.post('/system/permWhitelist/add', data);
}

/** 删除白名单：POST /system/permWhitelist/delete */
export function deletePermWhitelist(data: Record<string, unknown>) {
  return requestClient.post('/system/permWhitelist/delete', data);
}
