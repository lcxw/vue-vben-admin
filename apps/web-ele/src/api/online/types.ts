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
  options?: Array<{ label: string; value: number | string }>;
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
  categoryId?: string;
  formType?: number;
  viewType?: number;
  formKind?: number;
  storageType?: number;
  widgetJson?: string;
  queryJson?: string;
  fieldJson?: string;
  paramsJson?: string;
  masterTable?: string;
  pkColumn?: string;
  dblinkCode?: string;
  status?: number;
  version?: number;
  remark?: string;
  createBy?: string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
}

export type OnlineFormDTO = Partial<OnlineFormVO> &
  Pick<OnlineFormVO, 'formName'>;

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
  dicts?: Record<string, Array<{ label: string; value: number | string }>>;
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
  value: number | string;
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

// ---------------- 本期扩展：数据权限 / 工单 / 数据源 / 脚本 ----------------

export interface OnlineDataPermVO {
  permId?: string;
  formId: string;
  scopeType: number;
  customUserIds?: string;
  customDeptIds?: string;
  enabled?: number;
  createTime?: string;
}

export interface OnlineDataPermDTO {
  formId: string;
  scopeType: number;
  customUserIds?: string[];
  customDeptIds?: string[];
  enabled?: number;
}

export const ONLINE_DATA_SCOPES = [
  { label: '全部数据', value: 0 },
  { label: '仅本人', value: 1 },
  { label: '本部门', value: 2 },
  { label: '本部门及下级', value: 3 },
  { label: '自定义', value: 4 },
] as const;

export interface OnlineWorkOrderVO {
  orderId: string;
  formId?: string;
  businessKey?: string;
  orderCode: string;
  title?: string;
  status?: number;
  payloadJson?: string;
  createBy?: string;
  createTime?: string;
  updateTime?: string;
}

export interface OnlineDblinkVO {
  dblinkId?: string;
  code: string;
  name: string;
  dbType?: string;
  jdbcUrl: string;
  username?: string;
  /** 永远返回 ******，留空表示不修改 */
  password?: string;
  driverClass?: string;
  maxRows?: number;
  queryTimeout?: number;
  enabled?: number;
  createTime?: string;
}

export interface OnlineSqlExecReq {
  dblinkCode: string;
  sql: string;
  params?: unknown[];
  maxRows?: number;
}

export interface OnlineSqlResult {
  success: boolean;
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  errorMsg?: string;
}

export interface OnlineSqlAuditVO {
  auditId: string;
  dblinkCode?: string;
  sql?: string;
  paramsJson?: string;
  rowCount?: number;
  durationMs?: number;
  success?: number;
  errorMsg?: string;
  createBy?: string;
  createTime?: string;
}

export interface OnlineScriptVO {
  scriptId?: string;
  code: string;
  name: string;
  groupCode?: string;
  content: string;
  paramsJson?: string;
  enabled?: number;
  remark?: string;
  createTime?: string;
}

export interface OnlineScriptLogVO {
  logId: string;
  scriptCode?: string;
  scriptName?: string;
  paramsJson?: string;
  resultJson?: string;
  durationMs?: number;
  success?: number;
  errorMsg?: string;
  createTime?: string;
}

// ==================== 在线表单建模重构（V14+） ====================

/** 字段/控件事件脚本 */
export interface FormWidgetEvent {
  id?: string;
  /** visible / disabled / change / beforeQuery / afterQuery / afterCreate / rowClick / cellClick */
  eventType: string;
  name?: string;
  enabled?: boolean;
  script?: string;
}

/** 控件样式配置 */
export interface FormWidgetStyle {
  width?: string;
  labelWidth?: number | string;
  margin?: string;
  padding?: string;
  background?: string;
  borderRadius?: string;
  border?: string;
  color?: string;
  fontSize?: number | string;
  textAlign?: string;
  customClass?: string;
  customStyle?: string;
}

/** 字段建模项：同时描述渲染/存储/查询/列表策略 */
export interface FormFieldModel {
  fieldKey: string;
  /** 设计态唯一 key */
  key?: string;
  column?: string;
  label: string;
  widgetType: string;
  dictCode?: string;
  options?: Array<{ label: string; value: number | string }>;
  required?: boolean;
  placeholder?: string;
  width?: number;
  /** 查询条件固定像素宽，0 表示跟随表单配置 */
  itemWidth?: number;
  visible?: boolean;
  advanced?: boolean;
  align?: 'center' | 'left' | 'right';
  fixed?: '' | 'left' | 'right';
  sortable?: boolean;
  show?: boolean;
  minWidth?: number;
  className?: string;
  props?: Record<string, any>;
  events?: FormWidgetEvent[];
  styleConfig?: FormWidgetStyle;
  defaultValue?: unknown;
  isQuery?: boolean;
  filterType?: number;
  isList?: boolean;
  isForm?: boolean;
  showOrder?: number;
  validationJson?: string;
  fieldKind?: string;
}

/** 查询条件区配置 */
export interface FormFilterConfig {
  itemWidth: number;
  gutter: number;
  columns: number;
  labelWidth: number;
  labelPosition: 'left' | 'right' | 'top';
  collapsible: boolean;
  defaultRows: number;
  showSearch: boolean;
  showReset: boolean;
  searchText: string;
  resetText: string;
  hideLabel: boolean;
}

/** 左树配置 */
export interface FormLeftTreeConfig {
  enabled: boolean;
  title: string;
  width: number;
  dictCode?: string;
  field?: string;
  showSearch: boolean;
  searchPlaceholder: string;
  defaultExpandAll: boolean;
  showAllNode: boolean;
  allLabel: string;
  events?: FormWidgetEvent[];
}

/** 表单字段模型配置（form.fieldJson） */
export interface FormFieldSchema {
  masterTable?: string;
  pkColumn?: string;
  dblinkCode?: string;
  logicDeleteCol?: string;
  sortCol?: string;
  fields: FormFieldModel[];
}

/** 分类树节点 */
export interface OnlineCategoryVO {
  categoryId: string;
  parentId: string;
  categoryName: string;
  categoryCode?: string;
  sortNo?: number;
  remark?: string;
  children?: OnlineCategoryVO[];
}
export type OnlineCategoryDTO = Partial<OnlineCategoryVO> &
  Pick<OnlineCategoryVO, 'categoryName'>;

/** 字典项 */
export interface OnlineDictItemVO {
  itemId: string;
  dictCode: string;
  itemLabel: string;
  itemValue: string;
  parentValue?: string;
  sortNo?: number;
  status?: number;
  remark?: string;
  createTime?: string;
}
export type OnlineDictItemDTO = Partial<OnlineDictItemVO> &
  Pick<OnlineDictItemVO, 'dictCode' | 'itemLabel' | 'itemValue'>;

/** 页面 Tab */
export interface OnlinePageTabVO {
  tabId: string;
  pageId: string;
  tabName: string;
  formId: string;
  formName?: string;
  viewType?: number;
  sortNo?: number;
  enabled?: number;
}
export type OnlinePageTabDTO = Partial<OnlinePageTabVO> &
  Pick<OnlinePageTabVO, 'formId'>;

/** 页面（多 Tab 容器） */
export interface OnlinePageVO {
  pageId: string;
  pageCode: string;
  pageName: string;
  categoryId?: string;
  layoutJson?: string;
  remark?: string;
  createTime?: string;
  tabs: OnlinePageTabVO[];
}
export type OnlinePageDTO = Partial<OnlinePageVO> &
  Pick<OnlinePageVO, 'pageName'>;

/** 运行时表单配置（前端自动渲染的契约核心） */
export interface FormRuntimeVO {
  formId: string;
  formCode?: string;
  formName: string;
  viewType: number;
  formKind: number;
  storageType: number;
  masterTable?: string;
  pkColumn?: string;
  version?: number;
  fields: FormFieldModel[];
  dicts: Record<
    string,
    Array<{ label: string; value: number | string; parentValue?: string }>
  >;
}

/** 运行时分页结果 */
export interface RunQueryVO {
  rows: Array<
    Record<string, unknown> & {
      _labels?: Record<string, unknown>;
      _dataId?: string;
    }
  >;
  total: number;
  pageNum: number;
  pageSize: number;
  pkColumn?: string;
}

/** 数据源表 / 列信息 */
export interface SchemaTableVO {
  tableName: string;
  tableComment?: string;
}
export interface SchemaColumnVO {
  columnName: string;
  dataType?: string;
  columnSize?: number;
  nullable?: boolean;
  primaryKey?: boolean;
  columnComment?: string;
}

/** 视图/形态常量（v4：视图类型与 page_role 一一对应） */
export const ONLINE_VIEW_TYPES = [
  { label: '列表页', value: 1 },
  { label: '分组列表', value: 2 },
  { label: '选择弹窗', value: 3 },
  { label: '表单页', value: 5 },
  { label: '统计页', value: 6 },
  { label: '行编辑弹窗', value: 9 },
  { label: '详情页', value: 10 },
] as const;
export const ONLINE_FORM_KINDS = [
  { label: '基础表单', value: 1 },
  { label: '统计报表', value: 5 },
  { label: '流程表单', value: 10 },
  { label: '工单表单', value: 11 },
] as const;
export const ONLINE_STORAGE_TYPES = [
  { label: '物理表', value: 1 },
  { label: 'JSON文档', value: 0 },
] as const;
export const ONLINE_FILTER_TYPES = [
  { label: '等于', value: 1 },
  { label: '模糊', value: 2 },
  { label: '范围', value: 3 },
  { label: 'IN列表', value: 4 },
  { label: '大于', value: 5 },
  { label: '小于', value: 6 },
] as const;

// ==================== 页面设计工作台 v2（pageId 主线向导） ====================

export interface WizardColumn {
  columnModelId: string;
  columnName: string;
  columnComment?: string;
  dataType?: string;
  widgetType?: string;
  dictCode?: string;
  isPk?: number;
  isQuery?: number;
  isList?: number;
  isForm?: number;
  filterType?: number;
  showOrder?: number;
}

export interface WizardTable {
  tableModelId: string;
  tableName: string;
  tableComment?: string;
  primaryKey?: string;
  logicDeleteCol?: string;
  isMaster?: number;
  columns: WizardColumn[];
}

export interface WizardRelation {
  edgeId: string;
  edgeName?: string;
  fromTableId: string;
  fromColumn: string;
  toTableId: string;
  toColumn: string;
  cardinality?: string;
  joinType?: string;
  showOrder?: number;
}

export interface WizardForm {
  formId: string;
  formCode?: string;
  formName: string;
  pageRole?: string;
  viewType?: number;
  storageType?: number;
  status?: number;
}

export interface PageVo {
  pageId: string;
  pageCode: string;
  pageName: string;
  /** 0-基础信息 1-数据模型 2-设计表单 */
  status: number;
  /** 1-业务 5-统计 10-流程 */
  pageType: number;
  published: number;
  dblinkCode?: string;
  masterTableId?: string;
  categoryId?: string;
  layoutJson?: string;
  remark?: string;
  createTime?: string;
  tabs?: unknown[];
  tables: WizardTable[];
  relations: WizardRelation[];
  forms: WizardForm[];
}

export const WIZARD_STEPS = [
  { label: '基础信息', value: 0 },
  { label: '数据模型', value: 1 },
  { label: '设计表单', value: 2 },
  { label: '发布运行', value: 3 },
] as const;
export const WIZARD_PAGE_TYPES = [
  { label: '业务页面', value: 1 },
  { label: '统计页面', value: 5 },
  { label: '流程页面', value: 10 },
] as const;

// ==================== v3 表单运行时聚合（唯一运行时组件） ====================

export interface FormOperation {
  type: number; // 0新建 1编辑 2删除 10批量删除 30保存 31取消
  name: string;
  formId?: string;
  rowOperation?: boolean;
  enabled?: boolean;
  btnType?: string;
  btnClass?: string;
  showOrder?: number;
}

export interface FormDesignTableWidget {
  tableId?: string;
  datasourceId?: string;
  relationId?: string;
  tableColumnList: FormFieldModel[];
  operationList: FormOperation[];
  paged?: boolean;
  pageSize?: number;
  pageSizes?: number[];
  showIndex?: boolean;
  border?: boolean;
  stripe?: boolean;
  height?: number;
  maxHeight?: number;
  orderColumn?: string;
  orderAsc?: boolean;
  likeQueryColumn?: string[];
  /** 是否树形表格：平铺行按 pidColumn 转树 */
  tree?: boolean;
  /** 树形父级列（如 parent_id/grade_id） */
  pidColumn?: string;
  /** 树形表格默认展开全部 */
  treeExpandAll?: boolean;
  styleConfig?: FormWidgetStyle;
}

export interface FormSubTable {
  edgeId: string;
  title: string;
  tableId?: string;
  tableName?: string;
  /** 从表外键列（edge.toColumn） */
  fkColumn: string;
  /** 主表关联列（edge.fromColumn） */
  masterColumn?: string;
  /** 从表行编辑弹窗表单 Id */
  dialogFormId?: string;
  columns: FormFieldModel[];
}

export interface FormRefSelect {
  /** 本表外键列（edge.toColumn） */
  fkColumn: string;
  refTableId?: string;
  refTableName?: string;
  refTitle?: string;
  refPkColumn?: string;
  /** 关联选择弹窗表单 Id（pageRole=pick） */
  pickFormId?: string;
  displayColumns: FormFieldModel[];
}

export interface FormDesignTree {
  formKey?: string;
  labelWidth?: string;
  labelPosition?: string;
  size?: string;
  /** 查询页布局：flat 纯条件 / tree 左树右表 */
  layout?: 'flat' | 'tree';
  filter?: FormFilterConfig;
  leftTree?: FormLeftTreeConfig;
  widgetList: FormFieldModel[];
  tableWidget?: FormDesignTableWidget;
  operationList: FormOperation[];
  formEventList?: FormWidgetEvent[];
  formStyle?: FormWidgetStyle;
  charts?: Array<Record<string, unknown>>;
  /** 主子表编辑：render 从 ONE_TO_MANY 关系边自动推导（零配置） */
  subTables?: FormSubTable[];
  /** 一对一/多对一关联选择：render 从指向本表的关系边自动推导（零配置） */
  refSelects?: FormRefSelect[];
}

export interface FormRenderVo {
  formId: string;
  formCode?: string;
  formName: string;
  /** 1查询 2高级查询 3一对一选择 4多标签 5编辑 10流程 11工单 */
  formType: number;
  /** v4 视图类型：1列表 2分组 3选择 5表单 6统计 9行编辑 10详情 */
  viewType?: number;
  pageId?: string;
  pageCode?: string;
  pageName?: string;
  published?: number;
  formKind: number;
  masterTable?: string;
  pkColumn?: string;
  dblinkCode?: string;
  version?: number;
  design: FormDesignTree;
  tableMap: Record<string, Record<string, unknown>>;
  columnMap: Record<string, Record<string, unknown>>;
  dicts: Record<string, Array<{ label: string; value: number | string }>>;
  relations: Array<Record<string, unknown>>;
  /** 同页面下的其它表单（查询表单操作解析编辑表单用） */
  forms: Array<{
    formId: string;
    formCode?: string;
    formName: string;
    pageRole?: string;
    viewType?: number;
    formKind?: number;
  }>;
  runtimeBase: string;
}

/** 统计图表聚合结果（维度+指标） */
export interface AggregateChart {
  title: string;
  /** bar-柱状 pie-饼图 line-折线 */
  type: string;
  dictCode?: string;
  data: Array<{ name: string; value: number | string }>;
}
