/**
 * 运行时渲染兼容层：旧调用名保留，实际走表单中心端点。
 * 新代码请直接用 `renderForm` / `aggregateForm`（api/online/formCenter.ts）。
 */
import type { AggregateChart, FormRenderVo } from './types';

import { requestClient } from '#/api/request';

export function renderFormRuntime(formId: string): Promise<FormRenderVo> {
  return requestClient.post<FormRenderVo>('/online/form/render', { formId });
}

export function aggregateOnlineForm(formId: string): Promise<AggregateChart[]> {
  return requestClient.post<AggregateChart[]>('/online/form/aggregate', {
    formId,
  });
}
