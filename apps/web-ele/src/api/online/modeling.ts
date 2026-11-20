/**
 * 在线表单建模重构 API：分类 / 字典项 / 页面 / 数据源表结构 / 运行时引擎。
 */
import type {
  FormRuntimeVO,
  OnlineCategoryDTO,
  OnlineCategoryVO,
  OnlineDictItemDTO,
  OnlineDictItemVO,
  OnlinePageDTO,
  OnlinePageVO,
  RunQueryVO,
  SchemaColumnVO,
  SchemaTableVO,
} from './types';

import { requestClient } from '#/api/request';

// ---------------- 分类 ----------------
export function getCategoryTree(): Promise<OnlineCategoryVO[]> {
  return requestClient.post<OnlineCategoryVO[]>('/online/category/tree', {});
}
export function getCategoryList(): Promise<OnlineCategoryVO[]> {
  return requestClient.post<OnlineCategoryVO[]>('/online/category/list', {});
}
export function saveCategory(data: OnlineCategoryDTO): Promise<OnlineCategoryVO> {
  return requestClient.post<OnlineCategoryVO>('/online/category/save', data);
}
export function deleteCategory(categoryId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/category/delete', { categoryId });
}

// ---------------- 字典项 ----------------
export function getDictItems(dictCode: string): Promise<OnlineDictItemVO[]> {
  return requestClient.post<OnlineDictItemVO[]>('/online/dict-item/list', { dictCode });
}
export function saveDictItem(data: OnlineDictItemDTO): Promise<OnlineDictItemVO> {
  return requestClient.post<OnlineDictItemVO>('/online/dict-item/save', data);
}
export function deleteDictItem(itemId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/dict-item/delete', { itemId });
}

// ---------------- 页面（多 Tab） ----------------
export function getPageList(): Promise<OnlinePageVO[]> {
  return requestClient.post<OnlinePageVO[]>('/online/page/list', {});
}
export function getPage(pageId: string): Promise<OnlinePageVO> {
  return requestClient.post<OnlinePageVO>('/online/page/view', { pageId });
}
export function getPageByCode(pageCode: string): Promise<OnlinePageVO> {
  return requestClient.post<OnlinePageVO>('/online/page/viewByCode', { pageCode });
}
export function savePage(data: OnlinePageDTO): Promise<OnlinePageVO> {
  return requestClient.post<OnlinePageVO>('/online/page/save', data);
}
export function savePageTabs(pageId: string, tabs: unknown[]): Promise<OnlinePageVO> {
  return requestClient.post<OnlinePageVO>('/online/page/saveTabs', { pageId, tabs });
}
export function deletePage(pageId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/page/delete', { pageId });
}

// ---------------- 数据源表结构反射 ----------------
export function getSchemaTables(dblinkCode: string, keyword?: string): Promise<SchemaTableVO[]> {
  return requestClient.post<SchemaTableVO[]>('/online/schema/tables', {
    dblinkCode,
    keyword: keyword ?? '',
  });
}
export function getSchemaColumns(dblinkCode: string, tableName: string): Promise<SchemaColumnVO[]> {
  return requestClient.post<SchemaColumnVO[]>('/online/schema/columns', { dblinkCode, tableName });
}
export function importTableModel(params: {
  dsId: string;
  dblinkCode: string;
  tableName: string;
  primaryKey?: string;
  logicDeleteCol?: string;
}): Promise<unknown> {
  return requestClient.post<unknown>('/online/schema/importTable', params);
}

// ---------------- 运行时引擎 ----------------
export function getRunConfig(formId: string): Promise<FormRuntimeVO> {
  return requestClient.post<FormRuntimeVO>('/online/run/config', { formId });
}
export function runQuery(params: {
  formId: string;
  filters?: Record<string, unknown>;
  pageNum?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: string;
}): Promise<RunQueryVO> {
  return requestClient.post<RunQueryVO>('/online/run/query', params);
}
export function runDetail(formId: string, pkValue: unknown): Promise<Record<string, unknown>> {
  return requestClient.post<Record<string, unknown>>('/online/run/detail', { formId, pkValue });
}
export function runSave(params: {
  formId: string;
  data: Record<string, unknown>;
  pkValue?: unknown;
  businessKey?: string;
}): Promise<unknown> {
  return requestClient.post<unknown>('/online/run/save', params);
}
export function runDelete(formId: string, pkValue: unknown): Promise<unknown> {
  return requestClient.post<unknown>('/online/run/delete', { formId, pkValue });
}
