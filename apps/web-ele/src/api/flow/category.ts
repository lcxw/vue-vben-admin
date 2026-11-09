import type {
  FlowCategoryDTO,
  FlowCategoryVO,
  FlowIdReq,
} from './types';

import { requestClient } from '#/api/request';
import { toGridList } from '#/api/system/types';

const BASE = '/flow/category';

export function getFlowCategoryList(): Promise<FlowCategoryVO[]> {
  return requestClient.post<FlowCategoryVO[]>(`${BASE}/list`, {});
}

/** vxe-grid 用：分类不分页，转成 { items, total } */
export async function getFlowCategoryGrid() {
  return toGridList(await getFlowCategoryList());
}

export function getFlowCategoryDict(): Promise<
  { code?: string; id: string; name: string }[]
> {
  return requestClient.post(`${BASE}/listDict`, {});
}

export function getFlowCategory(id: string): Promise<FlowCategoryVO> {
  const req: FlowIdReq = { categoryId: id };
  return requestClient.post<FlowCategoryVO>(`${BASE}/view`, req);
}

export function createFlowCategory(
  data: FlowCategoryDTO,
): Promise<FlowCategoryVO> {
  return requestClient.post<FlowCategoryVO>(`${BASE}/add`, data);
}

export function updateFlowCategory(
  data: FlowCategoryDTO,
): Promise<FlowCategoryVO> {
  return requestClient.post<FlowCategoryVO>(`${BASE}/update`, data);
}

export function deleteFlowCategory(id: string): Promise<void> {
  const req: FlowIdReq = { categoryId: id };
  return requestClient.post<void>(`${BASE}/delete`, req);
}
