/**
 * 在线表单支撑 API：分类 / 字典项 / 数据源表结构 / 运行时引擎。
 * 表单本身（列表/新建/设计/发布）见 `api/online/formCenter.ts`。
 */
import type {
  FormRuntimeVO,
  OnlineCategoryDTO,
  OnlineCategoryVO,
  OnlineDictItemDTO,
  OnlineDictItemVO,
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
export function saveCategory(
  data: OnlineCategoryDTO,
): Promise<OnlineCategoryVO> {
  return requestClient.post<OnlineCategoryVO>('/online/category/save', data);
}
export function deleteCategory(categoryId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/category/delete', { categoryId });
}

// ---------------- 字典项 ----------------
export function getDictItems(dictCode: string): Promise<OnlineDictItemVO[]> {
  return requestClient.post<OnlineDictItemVO[]>('/online/dict-item/list', {
    dictCode,
  });
}
export function saveDictItem(
  data: OnlineDictItemDTO,
): Promise<OnlineDictItemVO> {
  return requestClient.post<OnlineDictItemVO>('/online/dict-item/save', data);
}
export function deleteDictItem(itemId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/dict-item/delete', { itemId });
}

// ---------------- 数据源表结构反射 ----------------
export function getSchemaTables(
  dblinkCode: string,
  keyword?: string,
): Promise<SchemaTableVO[]> {
  return requestClient.post<SchemaTableVO[]>('/online/schema/tables', {
    dblinkCode,
    keyword: keyword ?? '',
  });
}
export function getSchemaColumns(
  dblinkCode: string,
  tableName: string,
): Promise<SchemaColumnVO[]> {
  return requestClient.post<SchemaColumnVO[]>('/online/schema/columns', {
    dblinkCode,
    tableName,
  });
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
  filters?: Record<string, unknown>;
  filterTypes?: Record<string, number>;
  formId: string;
  orderBy?: string;
  orderDir?: string;
  pageNum?: number;
  pageSize?: number;
}): Promise<RunQueryVO> {
  return requestClient.post<RunQueryVO>('/online/run/query', params);
}
export function runDetail(
  formId: string,
  pkValue: unknown,
): Promise<Record<string, unknown>> {
  return requestClient.post<Record<string, unknown>>('/online/run/detail', {
    formId,
    pkValue,
  });
}
export function runSave(params: {
  businessKey?: string;
  data: Record<string, unknown>;
  formId: string;
  pkValue?: unknown;
}): Promise<unknown> {
  return requestClient.post<unknown>('/online/run/save', params);
}
export function runDelete(formId: string, pkValue: unknown): Promise<unknown> {
  return requestClient.post<unknown>('/online/run/delete', { formId, pkValue });
}
