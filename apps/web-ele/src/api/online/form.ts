import type { BackendPage } from '#/api/system/types';
import type {
  OnlineFormDTO,
  OnlineFormDictItem,
  OnlineFormQuery,
  OnlineFormVO,
  OnlineRenderVO,
} from './types';

import { requestClient } from '#/api/request';
import { toGridPage } from '#/api/system/types';

const BASE = '/online/form';

export async function getOnlineFormPage(params: OnlineFormQuery) {
  const page = await requestClient.post<BackendPage<OnlineFormVO>>(
    `${BASE}/list`,
    params,
  );
  return toGridPage(page);
}

export function getOnlineFormList(): Promise<OnlineFormVO[]> {
  return requestClient.post<OnlineFormVO[]>(`${BASE}/listAll`, {});
}

/** 已发布表单下拉（流程绑定用） */
export function getOnlineFormDict(): Promise<OnlineFormDictItem[]> {
  return requestClient.post<OnlineFormDictItem[]>(`${BASE}/listDict`, {});
}

export function getOnlineForm(formId: string): Promise<OnlineFormVO> {
  return requestClient.post<OnlineFormVO>(`${BASE}/view`, { formId });
}

export function createOnlineForm(data: OnlineFormDTO): Promise<OnlineFormVO> {
  return requestClient.post<OnlineFormVO>(`${BASE}/add`, data);
}

export function updateOnlineForm(data: OnlineFormDTO): Promise<OnlineFormVO> {
  return requestClient.post<OnlineFormVO>(`${BASE}/update`, data);
}

export function deleteOnlineForm(formId: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/delete`, { formId });
}

export function publishOnlineForm(formId: string): Promise<OnlineFormVO> {
  return requestClient.post<OnlineFormVO>(`${BASE}/publish`, { formId });
}

export function cloneOnlineForm(formId: string): Promise<OnlineFormVO> {
  return requestClient.post<OnlineFormVO>(`${BASE}/clone`, { formId });
}

/**
 * 运行时渲染：直接按 formId 取 schema + data + dicts。
 * 流程内办理/详情优先走 `renderFlowForm`（会解析节点 formKey）。
 */
export function renderOnlineForm(params: {
  businessKey?: string;
  data?: Record<string, unknown>;
  formId: string;
  readOnly?: boolean;
}): Promise<OnlineRenderVO> {
  return requestClient.post<OnlineRenderVO>(`${BASE}/render`, params);
}

/** 流程运行时渲染（节点 formKey 优先，回落流程默认表单） */
export function renderFlowForm(params: {
  readOnly?: boolean;
  taskInstanceId?: string;
  variables?: Record<string, unknown>;
  workOrderId: string;
}): Promise<OnlineRenderVO> {
  return requestClient.post<OnlineRenderVO>(
    '/flow/runtime/renderForm',
    params,
  );
}

/** 发起前预览（仅凭 entryId 取 schema） */
export function renderFlowStartForm(params: {
  entryId: string;
  variables?: Record<string, unknown>;
}): Promise<OnlineRenderVO> {
  return requestClient.post<OnlineRenderVO>(
    '/flow/runtime/renderStartForm',
    params,
  );
}
