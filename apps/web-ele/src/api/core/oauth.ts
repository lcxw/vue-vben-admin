/**
 * OAuth2 授权码 + PKCE（public client）工具。
 *
 * 流程：
 * 1. 登录页调用 redirectToOAuth2Authorize，整页跳转到授权服务器 /oauth2/authorize；
 * 2. 用户在授权服务器自己的登录页完成认证（前端不接触密码）；
 * 3. 授权服务器 302 回 /oauth2/callback?code=...&state=...；
 * 4. 回调页用 code + code_verifier 在 /oauth2/token 换 access_token / refresh_token；
 * 5. 令牌过期时 request.ts 用 refresh_token 走同一 token 端点续期。
 */
import { baseRequestClient } from '#/api/request';

const AUTH_URL: string =
  import.meta.env.VITE_GLOB_AUTH_URL || 'http://127.0.0.1:20005';
const CLIENT_ID: string =
  import.meta.env.VITE_GLOB_OAUTH_CLIENT_ID || 'web-spa';
const REDIRECT_URI: string =
  import.meta.env.VITE_GLOB_OAUTH_REDIRECT_URI ||
  `${window.location.origin}/oauth2/callback`;
const SCOPE: string =
  import.meta.env.VITE_GLOB_OAUTH_SCOPE || 'openid profile email';

const STATE_KEY = 'oauth2_state';
const VERIFIER_KEY = 'oauth2_code_verifier';
const REDIRECT_KEY = 'oauth2_redirect_path';

export interface OAuth2TokenResponse {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * 生成 PKCE 参数与 state，返回授权端点完整地址。
 */
async function buildAuthorizeUrl(redirectPath?: string): Promise<string> {
  const state = randomBase64Url(16);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, codeVerifier);
  if (redirectPath) {
    sessionStorage.setItem(REDIRECT_KEY, redirectPath);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}/oauth2/authorize?${params.toString()}`;
}

/**
 * 整页跳转到授权服务器（登录页按钮调用）。
 *
 * @param redirectPath 登录完成后要回到的前端路由
 */
export async function redirectToOAuth2Authorize(
  redirectPath?: string,
): Promise<void> {
  window.location.assign(await buildAuthorizeUrl(redirectPath));
}

/**
 * 校验 state，并用授权码换 token。
 */
export async function exchangeCodeForToken(
  code: string,
  state: string,
): Promise<OAuth2TokenResponse> {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  if (!expectedState || expectedState !== state) {
    throw new Error('OAuth2 state 校验失败，请重新登录');
  }
  const codeVerifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!codeVerifier) {
    throw new Error('缺少 PKCE code_verifier，请重新登录');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });
  const resp = await baseRequestClient.post('/oauth2/token', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  return resp.data as OAuth2TokenResponse;
}

/**
 * 取出并清理登录前暂存的前端路由。
 */
export function takeRedirectPath(): string {
  const redirectPath = sessionStorage.getItem(REDIRECT_KEY) || '';
  sessionStorage.removeItem(REDIRECT_KEY);
  return redirectPath;
}

/**
 * 用 refresh_token 续期（public client 无需 client_secret）。
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<OAuth2TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const resp = await baseRequestClient.post('/oauth2/token', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return resp.data as OAuth2TokenResponse;
}
