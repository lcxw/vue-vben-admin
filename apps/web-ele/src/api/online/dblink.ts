import type { OnlineDblinkVO, OnlineSqlAuditVO, OnlineSqlExecReq, OnlineSqlResult } from './types';
import { requestClient } from '#/api/request';

const BASE = '/online/dblink';

export function getOnlineDblinkList(): Promise<OnlineDblinkVO[]> {
  return requestClient.post<OnlineDblinkVO[]>(`${BASE}/list`, {});
}

export function getOnlineDblink(dblinkId: string): Promise<OnlineDblinkVO> {
  return requestClient.post<OnlineDblinkVO>(`${BASE}/view`, { dblinkId });
}

export function saveOnlineDblink(data: OnlineDblinkVO): Promise<OnlineDblinkVO> {
  return requestClient.post<OnlineDblinkVO>(`${BASE}/save`, data);
}

export function deleteOnlineDblink(dblinkId: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/delete`, { dblinkId });
}

export function testOnlineDblink(dblinkId: string): Promise<OnlineSqlResult> {
  return requestClient.post<OnlineSqlResult>(`${BASE}/test`, { dblinkId });
}

export function executeDblinkQuery(data: OnlineSqlExecReq): Promise<OnlineSqlResult> {
  return requestClient.post<OnlineSqlResult>(`${BASE}/query`, data);
}

export function executeDblinkUpdate(data: OnlineSqlExecReq): Promise<OnlineSqlResult> {
  return requestClient.post<OnlineSqlResult>(`${BASE}/execute`, data);
}

export function getOnlineSqlAudits(dblinkCode?: string): Promise<OnlineSqlAuditVO[]> {
  return requestClient.post<OnlineSqlAuditVO[]>(`${BASE}/audits`, { dblinkCode });
}
