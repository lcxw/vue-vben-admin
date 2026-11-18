import type { OnlineDictDTO, OnlineDictOption, OnlineDictVO } from './types';

import { requestClient } from '#/api/request';

const BASE = '/online/dict';

export function getOnlineDictList(): Promise<OnlineDictVO[]> {
  return requestClient.post<OnlineDictVO[]>(`${BASE}/list`, {});
}

export function getOnlineDictOptions(dictCode: string): Promise<OnlineDictOption[]> {
  return requestClient.post<OnlineDictOption[]>(`${BASE}/options`, { dictCode });
}

export function getOnlineDict(dictId: string): Promise<OnlineDictVO> {
  return requestClient.post<OnlineDictVO>(`${BASE}/view`, { dictId });
}

export function createOnlineDict(data: OnlineDictDTO): Promise<OnlineDictVO> {
  return requestClient.post<OnlineDictVO>(`${BASE}/add`, data);
}

export function updateOnlineDict(data: OnlineDictDTO): Promise<OnlineDictVO> {
  return requestClient.post<OnlineDictVO>(`${BASE}/update`, data);
}

export function deleteOnlineDict(dictId: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/delete`, { dictId });
}
