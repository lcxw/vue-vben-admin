import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 将后端 LoginUserInfoVO 映射为前端 UserInfo
 *
 * 后端字段：avatarUrl / roles[{code,name}] / nickName
 * 前端字段：avatar / roles[string] / desc / homePath
 */
function toUserInfo(raw: any): UserInfo {
  const roles = Array.isArray(raw?.roles)
    ? raw.roles.map((r: any) => r.code ?? r.name ?? String(r))
    : [];
  return {
    avatar: raw?.avatarUrl ?? raw?.avatar ?? '',
    desc: raw?.nickName ?? raw?.description ?? '',
    homePath: raw?.homePath ?? '',
    realName: raw?.realName ?? raw?.nickName ?? raw?.username ?? '',
    roles,
    token: raw?.token ?? '',
    userId: String(raw?.userId ?? ''),
    username: raw?.username ?? '',
  };
}

/**
 * 获取用户信息
 *
 * 后端端点：GET /user/info
 * 后端返回 LoginUserInfoVO（由 system-server UserController 提供）
 */
export async function getUserInfoApi(): Promise<UserInfo> {
  const raw = await requestClient.get('/user/info');
  return toUserInfo(raw);
}
