/**
 * 在线表单中心 API —— v4 唯一产品门面。
 *
 * formId = 业务表单（容器），viewId = 容器下的视图；列表/新建/设计/发布/运行都走这里。
 */
import { requestClient } from '#/api/request';

export interface FormSummary {
  categoryId?: string;
  categoryName?: string;
  dblinkCode?: string;
  defaultViewId?: string;
  formCode: string;
  formId: string;
  formKind?: number;
  formName: string;
  icon?: string;
  masterTable?: string;
  masterTableComment?: string;
  menuId?: string;
  menuPath?: string;
  published?: number;
  remark?: string;
  status?: number;
  updateBy?: string;
  updateTime?: string;
  version?: number;
  viewCount?: number;
  viewTypes: number[];
}

export interface FormPage {
  current: number;
  pages: number;
  records: FormSummary[];
  size: number;
  total: number;
}

export interface FormColumn {
  columnComment?: string;
  columnModelId: string;
  columnName: string;
  dataType?: string;
  dictCode?: string;
  filterType?: number;
  isForm?: number;
  isList?: number;
  isNullable?: number;
  isPk?: number;
  isQuery?: number;
  isVirtual?: number;
  showOrder?: number;
  tableModelId?: string;
  widgetType?: string;
}

export interface FormTable {
  columns: FormColumn[];
  dsId?: string;
  isMaster?: number;
  logicDeleteCol?: string;
  primaryKey?: string;
  tableComment?: string;
  tableModelId: string;
  tableName: string;
}

export interface FormRelation {
  cardinality?: string;
  direction?: string;
  edgeId?: string;
  edgeName?: string;
  fromColumn: string;
  fromTableId: string;
  joinType?: string;
  toColumn: string;
  toTableId: string;
}

export interface FormView {
  fieldJson?: string;
  formKind?: number;
  masterTable?: string;
  pageRole: string;
  paramsJson?: string;
  sortNo?: number;
  status?: number;
  updateTime?: string;
  version?: number;
  viewCode: string;
  viewId: string;
  viewName: string;
  viewType: number;
  widgetJson?: string;
}

export interface FormDetail {
  categoryId?: string;
  categoryName?: string;
  dblinkCode?: string;
  dblinkName?: string;
  defaultViewId?: string;
  formCode: string;
  formId: string;
  formKind?: number;
  formName: string;
  icon?: string;
  masterTable?: string;
  masterTableId?: string;
  menuId?: string;
  menuPath?: string;
  published?: number;
  relations: FormRelation[];
  remark?: string;
  status?: number;
  tables: FormTable[];
  updateTime?: string;
  version?: number;
  views: FormView[];
}

export interface CreateFormReq {
  autoRelation?: boolean;
  categoryId?: string;
  dblinkCode: string;
  formCode?: string;
  formKind?: number;
  formName: string;
  icon?: string;
  masterTable: string;
  relatedTables?: string[];
  remark?: string;
}

export interface PublishFormReq {
  entryViewId?: string;
  formId: string;
  icon?: string;
  menuName?: string;
  menuParentId?: string;
  sortable?: number;
}

// ---------------- 列表 / 新建 ----------------

export function listForms(params: {
  categoryId?: string;
  formKind?: number;
  includeChildren?: boolean;
  keyword?: string;
  pageNum?: number;
  pageSize?: number;
  status?: number;
}): Promise<FormPage> {
  return requestClient.post<FormPage>('/online/form/list', params);
}

export function createForm(data: CreateFormReq): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/create', data);
}

export function getFormDetail(formId: string): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/detail', { formId });
}

export function updateForm(data: {
  categoryId?: string;
  defaultViewId?: string;
  formCode?: string;
  formId: string;
  formKind?: number;
  formName?: string;
  icon?: string;
  remark?: string;
}): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/update', data);
}

export function deleteForm(formId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/form/delete', { formId });
}

export function cloneForm(formId: string): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/clone', { formId });
}

// ---------------- 数据表 / 关系 ----------------

export function addFormTables(
  formId: string,
  tables: string[],
): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/table/add', {
    formId,
    tables,
  });
}

export function removeFormTable(
  formId: string,
  tableModelId: string,
): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/table/remove', {
    formId,
    tableModelId,
  });
}

export function saveFormRelation(
  formId: string,
  edge: FormRelation,
): Promise<FormRelation> {
  return requestClient.post<FormRelation>('/online/form/relation/save', {
    ...edge,
    formId,
  });
}

export function deleteFormRelation(
  formId: string,
  edgeId: string,
): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/relation/delete', {
    formId,
    edgeId,
  });
}

export function suggestFormRelations(formId: string): Promise<
  Array<{
    cardinality?: string;
    fromColumn: string;
    fromTableId: string;
    fromTableName: string;
    label: string;
    toColumn: string;
    toTableId: string;
    toTableName: string;
  }>
> {
  return requestClient.post('/online/form/relation/suggest', { formId });
}

// ---------------- 字段建模 / 视图 ----------------

export function saveFormFields(
  formId: string,
  fields: Array<
    Partial<FormColumn> & { columnModelId: string; sync?: boolean }
  >,
): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/field/batchSave', {
    fields,
    formId,
  });
}

export function listFormViews(formId: string): Promise<FormView[]> {
  return requestClient.post<FormView[]>('/online/form/view/list', { formId });
}

export function saveFormView(data: {
  fieldJson?: string;
  paramsJson?: string;
  viewId: string;
  widgetJson?: string;
}): Promise<unknown> {
  return requestClient.post<unknown>('/online/form/view/save', data);
}

export function syncFormViews(data: {
  force?: boolean;
  formId: string;
  viewId?: string;
}): Promise<FormDetail> {
  return requestClient.post<FormDetail>('/online/form/view/sync', data);
}

// ---------------- 发布 ----------------

export function publishForm(
  data: PublishFormReq,
): Promise<{ formId: string; menuId: string }> {
  return requestClient.post('/online/form/publish', data);
}

export function unpublishForm(formId: string): Promise<unknown> {
  return requestClient.post<unknown>('/online/form/unpublish', { formId });
}

export function getFormMenuOptions(): Promise<
  Array<{ id: string; name: string }>
> {
  return requestClient.post('/online/form/menu-options', {});
}

// ---------------- 运行时 ----------------

export function renderForm(formId: string): Promise<unknown> {
  return requestClient.post('/online/form/render', { formId });
}

export function aggregateForm(
  formId: string,
): Promise<Array<Record<string, unknown>>> {
  return requestClient.post('/online/form/aggregate', { formId });
}
