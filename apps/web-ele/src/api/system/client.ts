import type { BackendPage, GridPage } from './types';

import { requestClient } from '#/api/request';

import { toGridPage } from './types';

/**
 * oauth2_client 单表实体（2026-11-07 单表化后）。
 * 5 个附加属性是主表 JSON 数组列，后端类型是 Set<String>，JSON 里是数组。
 */
export interface OAuth2Client {
  accessTokenTimeToLive?: number;
  authorizationGrantTypes?: string[];
  clientAuthenticationMethods?: string[];
  clientId: string;
  clientIdIssuedAt?: string;
  clientName?: string;
  clientSecret?: string;
  clientSecretExpiresAt?: string;
  id: string;
  idTokenSignatureAlgorithm?: string;
  jwkSetUrl?: string;
  postLogoutRedirectUris?: string[];
  redirectUris?: string[];
  refreshTokenTimeToLive?: number;
  requireAuthorizationConsent?: boolean;
  requireProofKey?: boolean;
  reuseRefreshTokens?: boolean;
  scopes?: string[];
  signingAlgorithm?: string;
  tokenFormat?: string;
}

/** OAuth2ClientDTO：新增/编辑请求体 */
export interface OAuth2ClientForm {
  authorizationGrantTypes: string[];
  clientAuthenticationMethods: string[];
  clientId: string;
  clientIdIssuedAt?: string;
  clientName?: string;
  clientSecret?: string;
  id?: string;
  postLogoutRedirectUris: string[];
  redirectUris: string[];
  scopes: string[];
}

/**
 * OAuth2 scope 全局定义（定义与 client 关联分离）。
 *
 * 定义只描述 scope 是什么；某个 client 允许哪些 scope 仍由
 * oauth2_client.scopes JSON 列维护，在客户端编辑表单里配置。
 * openid 是内置定义，由后端自动注入，不可删除。
 */
export interface OAuth2ScopeDefinition {
  builtIn?: boolean;
  clientCount?: number;
  description?: null | string;
  scope: string;
}

export interface OAuth2ScopeDefinitionForm {
  description?: string;
  scope: string;
}

/**
 * 客户端分页：GET /system/client/data
 *
 * 后端 page 从 0 开始（PageRequest.of），vxe-grid 的 currentPage 从 1 开始，
 * 这里统一做 -1 转换。
 */
export async function getClientPage(
  currentPage: number,
  pageSize: number,
): Promise<GridPage<OAuth2Client>> {
  const page = await requestClient.get<BackendPage<OAuth2Client>>(
    '/system/client/data',
    { params: { limit: pageSize, page: Math.max(currentPage - 1, 0) } },
  );
  return toGridPage(page);
}

/** 客户端详情（含 JSON 集合列）：GET /system/client/details/{id} */
export function getClientDetail(id: string): Promise<OAuth2Client> {
  return requestClient.get<OAuth2Client>(`/system/client/details/${id}`);
}

/** 新增客户端：POST /system/client/add */
export function createClient(data: OAuth2ClientForm) {
  return requestClient.post('/system/client/add', data);
}

/**
 * 编辑客户端：POST /system/client/edit
 *
 * 后端忽略 clientSecret 变更，编辑时不要带 clientSecret；
 * 5 组集合字段传 null 表示「不修改」，传数组表示全量替换。
 */
export function updateClient(data: OAuth2ClientForm) {
  return requestClient.post('/system/client/edit', data);
}

/**
 * 删除客户端：POST /system/client/remove/{id}
 *
 * 后端 remove() 实际调用 oauth2ClientMapper.deleteById(id)，
 * 必须传主键 id（不是 clientId），与 /details/{id} 的键一致。
 */
export function deleteClient(id: string) {
  return requestClient.post(`/system/client/remove/${id}`);
}

/** 全量 scope 定义：GET /system/scope/list */
export function getScopeDefinitions(): Promise<OAuth2ScopeDefinition[]> {
  return requestClient.get<OAuth2ScopeDefinition[]>('/system/scope/list');
}

/** 新增/更新 scope 定义：POST /system/scope/save */
export function saveScopeDefinition(
  data: OAuth2ScopeDefinitionForm,
): Promise<OAuth2ScopeDefinition> {
  return requestClient.post<OAuth2ScopeDefinition>('/system/scope/save', data);
}

/** 删除 scope 定义：POST /system/scope/remove（query 参数） */
export function deleteScopeDefinition(scope: string) {
  return requestClient.post(
    '/system/scope/remove',
    {},
    { params: { scope } },
  );
}
