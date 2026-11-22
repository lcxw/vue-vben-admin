import type { BackendPage } from '#/api/system/types';
import type { OnlineWorkOrderVO } from './types';

import { requestClient } from '#/api/request';
import { toGridPage } from '#/api/system/types';

const BASE = '/online/order';

export function generateOrderCode(): Promise<{ orderCode: string }> {
  return requestClient.post<{ orderCode: string }>(`${BASE}/generateCode`, {});
}

export function getOnlineOrder(orderCode: string): Promise<OnlineWorkOrderVO> {
  return requestClient.post<OnlineWorkOrderVO>(`${BASE}/view`, { orderCode });
}

/** 按 businessKey（通常是 WO 工单号）回查在线工单与流程状态。 */
export function getOnlineOrderByBusinessKey(
  businessKey: string,
): Promise<OnlineWorkOrderVO> {
  return requestClient.post<OnlineWorkOrderVO>(`${BASE}/viewByBusinessKey`, {
    businessKey,
  });
}

export async function getOnlineOrderPage(params: {
  formId?: string;
  pageNum: number;
  pageSize: number;
  status?: number;
}) {
  const page = await requestClient.post<BackendPage<OnlineWorkOrderVO>>(`${BASE}/list`, params);
  return toGridPage(page);
}

export function updateOnlineOrderStatus(data: {
  businessKey?: string;
  orderCode?: string;
  status: number;
  title?: string;
}): Promise<OnlineWorkOrderVO> {
  return requestClient.post<OnlineWorkOrderVO>(`${BASE}/updateStatus`, data);
}
