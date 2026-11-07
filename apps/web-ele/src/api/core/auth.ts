import type { OAuth2TokenResponse } from './oauth';

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import { refreshAccessToken } from './oauth';

export namespace AuthApi {
  export type RefreshTokenResult = OAuth2TokenResponse;
}

/**
 * 刷新 accessToken（OAuth2 refresh_token grant）
 *
 * 后端端点：POST /oauth2/token
 * public client + PKCE，不需要 client_secret。
 */
export async function refreshTokenApi(): Promise<AuthApi.RefreshTokenResult> {
  const accessStore = useAccessStore();
  return refreshAccessToken(accessStore.refreshToken ?? '');
}

/**
 * 退出登录
 *
 * OAuth2 授权服务器会话由 IdP 维护，SPA 侧只清理本地令牌。
 */
export async function logoutApi() {
  // 本地登出由 store/auth.ts 的 resetAllStores 完成
}

/**
 * 获取用户权限码
 *
 * 后端端点：GET /permission/userCodes
 * 后端需返回：{ code: 200, data: ["perm:code1", "perm:code2"], msg: "ok" }
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/permission/userCodes');
}
