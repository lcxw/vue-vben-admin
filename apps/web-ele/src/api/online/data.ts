import type { BackendPage } from '#/api/system/types';
import type {
  OnlineFormDataVO,
  OnlineFormSubmitReq,
  OnlineFormSubmitVO,
} from './types';

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

/** 提交表单并发起流程：业务数据 + 在线工单 + 流程实例同事务落库。 */
export function submitOnlineForm(data: OnlineFormSubmitReq): Promise<OnlineFormSubmitVO> {
  return requestClient.post<OnlineFormSubmitVO>(`${BASE}/submit`, data);
}
