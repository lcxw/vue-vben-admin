import type { BackendPage } from '#/api/system/types';
import type { OnlineFormDataVO } from './types';

import { requestClient } from '#/api/request';
import { toGridPage } from '#/api/system/types';

const BASE = '/online/data';

export async function getOnlineDataPage(params: {
  businessKey?: string;
  formId?: string;
  pageNum: number;
  pageSize: number;
}) {
  const page = await requestClient.post<BackendPage<OnlineFormDataVO>>(
    `${BASE}/list`,
    params,
  );
  return toGridPage(page);
}

export function getOnlineData(dataId: string): Promise<OnlineFormDataVO> {
  return requestClient.post<OnlineFormDataVO>(`${BASE}/view`, { dataId });
}

export function saveOnlineData(data: {
  businessKey?: string;
  data: Record<string, unknown>;
  formId: string;
}): Promise<OnlineFormDataVO> {
  return requestClient.post<OnlineFormDataVO>(`${BASE}/save`, data);
}

export function deleteOnlineData(dataId: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/delete`, { dataId });
}
