/**
 * 在线表单：流程集成 + 运行时渲染兼容 API。
 * 表单中心自身的增删改查请用 `api/online/formCenter.ts`。
 */
import type { OnlineFormDictItem, OnlineRenderVO } from './types';

import { requestClient } from '#/api/request';

const BASE = '/online/form';

/** 已发布表单下拉（流程绑定用） */
export function getOnlineFormDict(): Promise<OnlineFormDictItem[]> {
  return requestClient.post<OnlineFormDictItem[]>(`${BASE}/listDict`, {});
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
  return requestClient.post<OnlineRenderVO>(`${BASE}/renderData`, params);
}

/** 流程运行时渲染（节点 formKey 优先，回落流程默认表单） */
export function renderFlowForm(params: {
  readOnly?: boolean;
  taskInstanceId?: string;
  variables?: Record<string, unknown>;
  workOrderId: string;
}): Promise<OnlineRenderVO> {
  return requestClient.post<OnlineRenderVO>('/flow/runtime/renderForm', params);
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
