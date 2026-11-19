import type { OnlineScriptLogVO, OnlineScriptVO, OnlineSqlResult } from './types';
import { requestClient } from '#/api/request';

const BASE = '/online/script';

export function getOnlineScriptList(groupCode?: string): Promise<OnlineScriptVO[]> {
  return requestClient.post<OnlineScriptVO[]>(`${BASE}/list`, { groupCode });
}

export function getOnlineScript(scriptId: string): Promise<OnlineScriptVO> {
  return requestClient.post<OnlineScriptVO>(`${BASE}/view`, { scriptId });
}

export function saveOnlineScript(data: OnlineScriptVO): Promise<OnlineScriptVO> {
  return requestClient.post<OnlineScriptVO>(`${BASE}/save`, data);
}

export function deleteOnlineScript(scriptId: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/delete`, { scriptId });
}

export function runOnlineScript(data: {
  params?: Record<string, unknown>;
  scriptCode?: string;
  content?: string;
}): Promise<OnlineSqlResult> {
  return requestClient.post<OnlineSqlResult>(`${BASE}/run`, data);
}

export function getOnlineScriptLogs(scriptCode: string): Promise<OnlineScriptLogVO[]> {
  return requestClient.post<OnlineScriptLogVO[]>(`${BASE}/logs`, { scriptCode });
}
