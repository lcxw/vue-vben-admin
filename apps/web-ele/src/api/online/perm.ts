import type { OnlineDataPermDTO, OnlineDataPermVO } from './types';
import { requestClient } from '#/api/request';

const BASE = '/online/perm';

export function getOnlineDataPerm(formId: string): Promise<null | OnlineDataPermVO> {
  return requestClient.post<null | OnlineDataPermVO>(`${BASE}/view`, { formId });
}

export function saveOnlineDataPerm(data: OnlineDataPermDTO): Promise<OnlineDataPermVO> {
  return requestClient.post<OnlineDataPermVO>(`${BASE}/save`, data);
}

export function deleteOnlineDataPerm(formId: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/delete`, { formId });
}
