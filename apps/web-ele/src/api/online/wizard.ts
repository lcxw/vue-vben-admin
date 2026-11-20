/**
 * 页面设计工作台（建模流水线）API。
 * 以 pageId 为主线：基础信息 → 数据模型 → 设计表单 → 发布运行。
 */
import type { PageVo } from './types';
import { requestClient } from '#/api/request';

const BASE = '/online/wizard';

export function getWizardList(): Promise<PageVo[]> {
  return requestClient.post<PageVo[]>(`${BASE}/list`, {});
}

export function getWizardPage(pageId: string): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/view`, { pageId });
}

/** Step1：保存基础信息（新建/编辑），返回含 pageId 的完整视图。 */
export function saveWizardBasic(data: {
  pageId?: string;
  pageCode?: string;
  pageName: string;
  pageType?: number;
  categoryId?: string;
  dblinkCode?: string;
  remark?: string;
}): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/basic`, data);
}

/** 推进/设置步骤状态。 */
export function setWizardStep(pageId: string, step: number): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/step`, { pageId, step });
}

/** Step2：从数据源勾选表，连库读 metadata 自动导表+字段。 */
export function importWizardTables(pageId: string, dblinkCode: string, tableNames: string[]): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/importTables`, { pageId, dblinkCode, tableNames });
}

/** Step2：配置表关系。 */
export function saveWizardRelation(pageId: string, edge: Record<string, unknown>): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/relation`, { pageId, edge });
}

export function deleteWizardRelation(pageId: string, edgeId: string): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/relation/delete`, { pageId, edgeId });
}

/** Step3：基于已选表字段自动生成 query/edit/detail 表单。 */
export function generateWizardForms(pageId: string): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/generateForms`, { pageId });
}

/** Step3：保存拖拽设计器产出的 widgetJson。 */
export function saveWizardWidget(formId: string, widgetJson: string): Promise<unknown> {
  return requestClient.post<unknown>(`${BASE}/saveWidget`, { formId, widgetJson });
}

/** Step4：发布（强制 status=2）。 */
export function publishWizardPage(pageId: string): Promise<PageVo> {
  return requestClient.post<PageVo>(`${BASE}/publish`, { pageId });
}

/** 删除页面。 */
export function deleteWizardPage(pageId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/page/delete', { pageId });
}

/** v3 运行时聚合配置（唯一运行时组件的数据源） */
export function renderFormRuntime(formId: string): Promise<import('./types').FormRenderVo> {
  return requestClient.post<import('./types').FormRenderVo>(`${BASE}/render`, { formId });
}

/** 发布并绑定在线表单菜单 */
export function publishFormMenu(pageId: string, entryFormId?: string): Promise<{ menuId: string }> {
  return requestClient.post<{ menuId: string }>(`${BASE}/publishMenu`, { pageId, entryFormId });
}

/** 统计聚合（统计表单 viewType=6 的图表数据） */
export function aggregateOnlineForm(formId: string): Promise<import('./types').AggregateChart[]> {
  return requestClient.post<import('./types').AggregateChart[]>(`${BASE}/aggregate`, { formId });
}
