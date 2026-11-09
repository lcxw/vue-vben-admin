/**
 * 流程配置模块（workflow-server :20007）前端类型与静态字典。
 *
 * 后端 Result<T> 已由 #/api/request 解包，这里只描述 data 的形状。
 * 契约与橙单 WebAdmin 的 flow.ts 对齐，但请求体是平铺 DTO（不再按 DTO 名包裹）。
 */

import type { PageQuery } from '#/api/system/types';

/** 流程分类 */
export interface FlowCategoryVO {
  categoryId: string;
  code?: string;
  createBy?: string;
  createTime?: string;
  deletedFlag?: number;
  name: string;
  remark?: string;
  showOrder?: number;
  updateBy?: string;
  updateTime?: string;
}

export type FlowCategoryDTO = Partial<FlowCategoryVO> &
  Pick<FlowCategoryVO, 'name' | 'code'>;

/** 流程定义 */
export interface FlowEntryVO {
  bpmnXml?: string;
  bindFormType?: number;
  categoryId?: string;
  categoryName?: string;
  createBy?: string;
  createTime?: string;
  defaultFormId?: string;
  defaultRouterName?: string;
  deletedFlag?: number;
  diagramType?: number;
  entryId: string;
  extensionData?: string;
  imageData?: string;
  latestPublishTime?: string;
  latestVersionName?: string;
  mainEntryPublishId?: string;
  mainVersionName?: string;
  pageId?: string;
  processDefinitionKey: string;
  processDefinitionName: string;
  publishCount?: number;
  remark?: string;
  status?: number;
  updateBy?: string;
  updateTime?: string;
}

export type FlowEntryDTO = Partial<FlowEntryVO>;

export interface FlowEntryQuery extends PageQuery {
  categoryId?: string;
  keyword?: string;
  status?: number;
}

/** 发布版本 */
export interface FlowPublishVO {
  activeStatus?: number;
  activeStatusName?: string;
  analyzedNodeJson?: string;
  bpmnXml?: string;
  createTime?: string;
  deployId?: string;
  entryId?: string;
  entryPublishId: string;
  initTaskInfo?: string;
  mainVersion?: number;
  processDefinitionId?: string;
  publishBy?: string;
  publishTime?: string;
  publishVersion?: number;
  versionName?: string;
}

/** 流程变量 */
export interface FlowVariableVO {
  bindColumnId?: string;
  bindDatasourceId?: string;
  bindRelationId?: string;
  builtin?: number;
  createTime?: string;
  deletedFlag?: number;
  entryId?: string;
  showName?: string;
  showOrder?: number;
  updateTime?: string;
  variableId: string;
  variableName?: string;
  variableType?: number;
  variableTypeName?: string;
}

export type FlowVariableDTO = Partial<FlowVariableVO>;

/** 设计器变量树 */
export interface FlowDesignerVariables {
  all: FlowVariableVO[];
  builtin: FlowVariableVO[];
  groups: Record<string, FlowVariableVO[]>;
}

/** 选人统一结构（id 一律字符串；用户 id 为 userId，不是 loginName） */
export interface FlowIdentityVO {
  code?: string;
  extra?: string;
  id: string;
  name: string;
  type: 'dept' | 'post' | 'role' | 'user';
}

export interface FlowSaveDraftReq {
  bpmnXml?: string;
  entryId: string;
  extensionData?: string;
  imageData?: string;
}

export interface FlowIdReq {
  categoryId?: string;
  deptIds?: number[];
  entryId?: string;
  entryPublishId?: string;
  ids?: string[];
  keyword?: string;
  newEntryPublishId?: string;
  roleIds?: string[];
  taskId?: string;
  variableId?: string;
}

/** 节点扩展配置快照 */
export interface FlowTaskExtVO {
  candidateUserIds?: string;
  copyListJson?: string;
  createTime?: string;
  deptIds?: string;
  deptPostListJson?: string;
  entryPublishId?: string;
  extraDataJson?: string;
  groupType?: string;
  id?: string;
  operationListJson?: string;
  processDefinitionId?: string;
  roleIds?: string;
  taskId?: string;
  taskName?: string;
  variableListJson?: string;
}

// ---------------- 静态字典（对齐橙单 src/common/staticDict/flow.ts） ----------------

export const FLOW_ENTRY_STATUS = [
  { label: '未发布', value: 0 },
  { label: '已发布', value: 1 },
] as const;

export const FLOW_VARIABLE_TYPE = [
  { label: '流程变量', value: 0 },
  { label: '任务变量', value: 1 },
  { label: '系统内置变量', value: 2 },
  { label: '输入参数', value: 4 },
] as const;

export const FLOW_BIND_FORM_TYPE = [
  { label: '在线表单', value: 0 },
  { label: '路由表单', value: 1 },
] as const;

export const FLOW_DIAGRAM_TYPE = [
  { label: '普通 BPMN', value: 0 },
  { label: '钉钉风格', value: 1 },
] as const;

/** 节点参与人类型（橙单 UserTask.vue 的 11 项，本项目首版实现前 5 项 + 变量/表达式） */
export const FLOW_GROUP_TYPE = [
  { label: '指定用户', value: 'user' },
  { label: '候选用户组', value: 'users' },
  { label: '指定角色', value: 'role' },
  { label: '指定部门', value: 'dept' },
  { label: '指定岗位', value: 'post' },
  { label: '流程变量', value: 'variable' },
  { label: '变量表达式', value: 'expression' },
  { label: '发起人领导', value: 'deptPostLeader' },
  { label: '发起人上级领导', value: 'upDeptPostLeader' },
  { label: '流程环节处理人', value: 'otherTaskSubmitter' },
  { label: '自动执行', value: 'autoExec' },
] as const;

export function dictLabel(
  dict: readonly { label: string; value: number | string }[],
  value?: null | number | string,
): string {
  return dict.find((item) => item.value === value)?.label ?? String(value ?? '');
}
