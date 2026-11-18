/**
 * 在线表单模块（workflow-server `/online/*` + `/flow/runtime/renderForm`）类型。
 * 后端 Result<T> 已由 requestClient 解包，这里只描述 data 形状。
 * widget_json schema 契约见 docs/online-form-flow-integration-design.md §2.4。
 */

import type { PageQuery } from '#/api/system/types';

export interface OnlineWidget {
  fieldKey: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  width?: number;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number }>;
  dictCode?: string;
  [key: string]: unknown;
}

export interface OnlineFormSchema {
  widgets: OnlineWidget[];
}

export interface OnlineFormVO {
  formId: string;
  formCode?: string;
  formName: string;
  formType?: number;
  widgetJson?: string;
  paramsJson?: string;
  masterTable?: string;
  status?: number;
  version?: number;
  remark?: string;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

export type OnlineFormDTO = Partial<OnlineFormVO> & Pick<OnlineFormVO, 'formName'>;

export interface OnlineFormQuery extends PageQuery {
  keyword?: string;
  status?: number;
}

export interface OnlineFormDictItem {
  id: string;
  name: string;
  code?: string;
  version?: number;
}

export interface OnlineRenderVO {
  formId: string;
  formCode?: string;
  formName?: string;
  version?: number;
  schema?: OnlineFormSchema;
  data?: Record<string, unknown>;
  dicts?: Record<string, Array<{ label: string; value: string | number }>>;
  readOnly?: boolean;
}

export interface OnlineFormDataVO {
  dataId: string;
  formId: string;
  businessKey?: string;
  dataJson?: string;
  formVersion?: number;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

export interface OnlineDictVO {
  dictId: string;
  dictCode: string;
  dictName: string;
  dataJson?: string;
  remark?: string;
  createBy?: string;
  createTime?: string;
}

export type OnlineDictDTO = Partial<OnlineDictVO> &
  Pick<OnlineDictVO, 'dictCode' | 'dictName'>;

export interface OnlineDictOption {
  label: string;
  value: string | number;
}

/** 控件类型字典（与后端 WidgetType.ALL 一一对应） */
export const ONLINE_WIDGET_TYPES = [
  { label: '单行文本', value: 'input' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '下拉框', value: 'select' },
  { label: '单选框', value: 'radio' },
  { label: '复选框', value: 'checkbox' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
  { label: '开关', value: 'switch' },
  { label: '分隔线', value: 'divider' },
] as const;

export const ONLINE_FORM_STATUS = [
  { label: '草稿', value: 0 },
  { label: '已发布', value: 1 },
] as const;

export function widgetTypeLabel(type?: string): string {
  return (
    ONLINE_WIDGET_TYPES.find((item) => item.value === type)?.label ?? type ?? ''
  );
}
