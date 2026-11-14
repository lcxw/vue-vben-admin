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
  Pick<FlowCategoryVO, 'code' | 'name'>;

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

/**
 * 节点参与人类型：与后端 FlowConstant.GROUP_TYPE_* 一一对应（11 项）。
 * 阶段 6 去掉了后端无实现的 users、补上预留的 api；hint 用于设计器场景说明，
 * kind 决定 FlowSceneForm 渲染哪一类配置控件。
 */
export const FLOW_GROUP_TYPE = [
  {
    hint: '从组织架构中挑选具体办理人',
    kind: 'user',
    label: '指定用户',
    value: 'user',
  },
  {
    hint: '该角色下的所有用户',
    kind: 'list',
    label: '指定角色',
    value: 'role',
  },
  {
    hint: '该部门及子部门下的所有用户',
    kind: 'tree',
    label: '指定部门',
    value: 'dept',
  },
  {
    hint: '拥有该岗位的所有用户',
    kind: 'list',
    label: '指定岗位',
    value: 'post',
  },
  {
    hint: '从流程变量中读取办理人 Id',
    kind: 'variable',
    label: '流程变量',
    value: 'variable',
  },
  {
    hint: '支持变量占位、var: 前缀或逗号分隔的用户 Id',
    kind: 'expression',
    label: '变量表达式',
    value: 'expression',
  },
  {
    hint: '发起人所在部门的负责人',
    kind: 'leader',
    label: '发起人领导',
    value: 'deptPostLeader',
  },
  {
    hint: '沿部门树上溯 N 级主管',
    kind: 'levels',
    label: '发起人上级领导',
    value: 'upDeptPostLeader',
  },
  {
    hint: '复用指定 BPMN 节点的上一个办理人',
    kind: 'node',
    label: '流程环节处理人',
    value: 'otherTaskSubmitter',
  },
  {
    hint: '无需人工办理，自动跳过该节点',
    kind: 'auto',
    label: '自动执行',
    value: 'autoExec',
  },
  {
    hint: '预留：由外部接口返回办理人 Id 列表',
    kind: 'api',
    label: '外部 API',
    value: 'api',
  },
] as const;

/** 设计器审批人场景的完整配置，与后端 flowable:Properties 的键一一对应。 */
export interface FlowSceneConfig {
  apiUrl: string;
  approvalMode: string;
  autoExec: boolean;
  copyUserIds: string[];
  deptIds: string[];
  expression: string;
  groupType: string;
  levels: number;
  otherTaskId: string;
  passRatio: string;
  postIds: string[];
  roleIds: string[];
  skipDuplicate: boolean;
  skipWhenEmpty: boolean;
  userIds: string[];
  variableName: string;
}

export function emptySceneConfig(): FlowSceneConfig {
  return {
    apiUrl: '',
    approvalMode: 'SINGLE',
    autoExec: false,
    copyUserIds: [],
    deptIds: [],
    expression: '',
    groupType: 'user',
    levels: 1,
    otherTaskId: '',
    passRatio: '',
    postIds: [],
    roleIds: [],
    skipDuplicate: true,
    skipWhenEmpty: true,
    userIds: [],
    variableName: '',
  };
}

export function dictLabel(
  dict: readonly { label: string; value: number | string }[],
  value?: null | number | string,
): string {
  return (
    dict.find((item) => item.value === value)?.label ?? String(value ?? '')
  );
}

// ---------------- 运行时（阶段 4B） ----------------
/**
 * 对齐 workflow-server 的 /flow/runtime、/flow/action、/flow/monitor 契约。
 * 后端返回裸对象并由 requestClient 解包 Result<T>，分页是 MyBatis-Plus Page
 * （records/total），由 toGridPage 转成 vxe-grid 的 items/total。
 */

export interface FlowTaskQuery extends PageQuery {
  enabled?: number;
  entryId?: string;
  keyword?: string;
  publicPoolOnly?: boolean;
  readFlag?: number;
  startTimeBegin?: string;
  startTimeEnd?: string;
  status?: number;
  userId?: string;
}

/** 节点按钮视图：由后端 zz_flow_task_ext.operation_list_json 下发。 */
export interface FlowOperationVO {
  code: string;
  icon?: string;
  label: string;
  needNode?: boolean;
  needUser?: boolean;
  needUsers?: boolean;
  order?: number;
  style?: string;
}

/** 选人分页结果。 */
export interface FlowIdentityPageVO {
  records: FlowIdentityVO[];
  total: number;
}

/** 部门 / 组织树节点。 */
export interface FlowIdentityNodeVO {
  children?: FlowIdentityNodeVO[];
  code?: string;
  id: string;
  name: string;
  parentId?: string;
  type?: string;
}

export interface FlowIdentityQueryReq {
  deptIds?: number[];
  ids?: string[];
  keyword?: string;
  pageNum?: number;
  pageSize?: number;
  roleIds?: string[];
}

/** 审批人场景预览请求（与运行时使用同一套解析逻辑）。 */
export interface FlowAssigneePreviewReq {
  apiUrl?: string;
  autoExec?: boolean;
  deptIds?: number[];
  expression?: string;
  groupType: string;
  initiator?: string;
  levels?: number;
  otherTaskId?: string;
  postIds?: string[];
  roleIds?: string[];
  skipDuplicate?: boolean;
  skipWhenEmpty?: boolean;
  taskSubmitters?: Record<string, string>;
  userIds?: string[];
  variableName?: string;
  variables?: Record<string, unknown>;
}

export interface FlowStatisticsVO {
  avgDurationMs?: number;
  backlogTasks?: number;
  byStatus?: Record<string, number>;
  returnedOrders?: number;
  returnRate?: number;
  totalOrders?: number;
}

export interface FlowTrendRow {
  bucket?: string;
  completed?: number;
  started?: number;
}

export interface FlowRankingRow {
  avgDurationMs?: number;
  completed?: number;
  completionRate?: number;
  entryId?: string;
  entryName?: string;
  total?: number;
}

export interface FlowTaskVO {
  approvalMode?: string;
  approvalModeName?: string;
  assignee?: string;
  assigneeName?: string;
  candidateUserIds?: string[];
  claimed?: boolean;
  createTime?: string;
  dueTime?: string;
  durationMs?: number;
  endTime?: string;
  engineTaskId?: string;
  id: string;
  initiator?: string;
  initiatorName?: string;
  orderTitle?: string;
  /** 该节点配置的审批按钮；后端未配置时回退默认按钮集。 */
  operations?: FlowOperationVO[];
  /** 本实例的用户任务节点（退回任意节点下拉用）。 */
  nodeOptions?: Array<{ id: string; name: string }>;
  processInstanceId?: string;
  signType?: string;
  status?: number;
  statusName?: string;
  taskDefKey?: string;
  taskName?: string;
  workOrderId?: string;
}

export interface FlowWorkOrderVO {
  businessKey?: string;
  currentNodeIds?: string;
  durationMs?: number;
  endTime?: string;
  entryId?: string;
  entryName?: string;
  entryPublishId?: string;
  processDefinitionId?: string;
  processInstanceId?: string;
  publishVersion?: number;
  startTime?: string;
  status?: number;
  statusName?: string;
  title?: string;
  initiator?: string;
  initiatorName?: string;
  workOrderId: string;
}

/** 「我的抄送」：/flow/runtime/listCc 的返回行。 */
export interface FlowCcVO {
  ccType?: string;
  content?: string;
  createTime?: string;
  id: string;
  initiatorName?: string;
  orderStatus?: number;
  orderStatusName?: string;
  orderTitle?: string;
  readFlag?: number;
  readTime?: string;
  senderId?: string;
  taskInstanceId?: string;
  userId?: string;
  workOrderId?: string;
}

/** 「流程委托」：/flow/runtime/listDelegates 的返回行。 */
export interface FlowDelegateVO {
  agentId?: string;
  agentName?: string;
  createTime?: string;
  delegateType?: string;
  enabled?: number;
  endTime?: string;
  id: string;
  orderTitle?: string;
  ownerId?: string;
  ownerName?: string;
  returnToOwner?: number;
  startTime?: string;
  taskInstanceId?: string;
  workOrderId?: string;
}

/** 实例级通用请求：按端点只填用到的字段。 */
export interface FlowOrderReq {
  entryId?: string;
  /** 监控趋势分桶：day / week / month */
  interval?: string;
  from?: string;
  reason?: string;
  targetNodeId?: string;
  to?: string;
  variables?: Record<string, unknown>;
  workOrderId?: string;
}

export interface FlowStartReq {
  assigneeHints?: Record<string, unknown>;
  businessKey?: string;
  draft?: boolean;
  entryId?: string;
  entryPublishId?: string;
  formData?: Record<string, unknown>;
  title?: string;
  variables?: Record<string, unknown>;
}

export interface FlowTaskActionReq {
  action: string;
  attachmentJson?: string;
  comment?: string;
  formData?: Record<string, unknown>;
  signType?: string;
  targetNodeId?: string;
  targetUserId?: string;
  targetUserIds?: string[];
  taskInstanceId?: string;
  timeoutMinutes?: number;
  variables?: Record<string, unknown>;
  workOrderId?: string;
}

export interface FlowTaskCommentVO {
  action?: string;
  actionName?: string;
  afterStatus?: number;
  attachmentJson?: string;
  beforeStatus?: number;
  comment?: string;
  createTime?: string;
  engineTaskId?: string;
  id?: string;
  operatorId?: string;
  operatorName?: string;
  targetNodeId?: string;
  targetUserId?: string;
  taskInstanceId?: string;
  taskName?: string;
  workOrderId?: string;
}

export interface FlowTaskInstanceVO {
  approvalMode?: string;
  assignee?: string;
  createTime?: string;
  dueTime?: string;
  durationMs?: number;
  endTime?: string;
  engineTaskId?: string;
  id?: string;
  parentTaskId?: string;
  processInstanceId?: string;
  signType?: string;
  sortOrder?: number;
  status?: number;
  taskDefKey?: string;
  taskName?: string;
  workOrderId?: string;
}

/** 流程图高亮数据（由后端审计记录推导，不依赖 Flowable HistoryService）。 */
export interface FlowHighlightVO {
  activeNodeIds?: string[];
  bpmnXml?: string;
  completedFlowIds?: string[];
  completedNodeIds?: string[];
  rejectedNodeIds?: string[];
}

export interface FlowMonitorVO {
  comments?: FlowTaskCommentVO[];
  highlight?: FlowHighlightVO;
  order?: Record<string, unknown>;
  tasks?: FlowTaskInstanceVO[];
  variables?: Record<string, unknown>;
}

/** 后端 FlowActionType 常量（审批历史/动作分发共用）。 */
export const FLOW_ACTION = {
  ACTIVATE: 'ACTIVATE',
  ADD_SIGN_AFTER: 'ADD_SIGN_AFTER',
  ADD_SIGN_BEFORE: 'ADD_SIGN_BEFORE',
  ADD_SIGN_COUNTERSIGN: 'ADD_SIGN_COUNTERSIGN',
  APPROVE: 'APPROVE',
  CC: 'CC',
  CLAIM: 'CLAIM',
  COMMENT: 'COMMENT',
  DELEGATE: 'DELEGATE',
  JUMP: 'JUMP',
  PROXY: 'PROXY',
  READ: 'READ',
  REJECT: 'REJECT',
  /** 拒绝：终态终止，与驳回（可重提）语义不同 */
  REFUSE: 'REFUSE',
  REMOVE_SIGN: 'REMOVE_SIGN',
  REPLACE_ASSIGNEE: 'REPLACE_ASSIGNEE',
  RETURN_ANY: 'RETURN_ANY',
  RETURN_INITIATOR: 'RETURN_INITIATOR',
  RETURN_PREVIOUS: 'RETURN_PREVIOUS',
  SUBMIT: 'SUBMIT',
  SUSPEND: 'SUSPEND',
  TAKE_BACK: 'TAKE_BACK',
  TERMINATE: 'TERMINATE',
  TRANSFER: 'TRANSFER',
  URGE: 'URGE',
  WITHDRAW: 'WITHDRAW',
} as const;

/** 待办页可发起的办理动作（需要目标用户/目标节点的动作单独带输入）。 */
export const FLOW_TASK_ACTIONS = [
  { label: '同意', value: FLOW_ACTION.APPROVE },
  { label: '驳回', value: FLOW_ACTION.REJECT },
  { label: '拒绝', value: FLOW_ACTION.REFUSE },
  { label: '退回上一步', value: FLOW_ACTION.RETURN_PREVIOUS },
  { label: '退回发起人', value: FLOW_ACTION.RETURN_INITIATOR },
  { label: '拿回', value: FLOW_ACTION.TAKE_BACK },
  { label: '转办', value: FLOW_ACTION.TRANSFER, needUser: true },
  { label: '前加签', value: FLOW_ACTION.ADD_SIGN_BEFORE, needUsers: true },
  { label: '后加签', value: FLOW_ACTION.ADD_SIGN_AFTER, needUsers: true },
  {
    label: '会签加签',
    value: FLOW_ACTION.ADD_SIGN_COUNTERSIGN,
    needUsers: true,
  },
  { label: '会签减签', value: FLOW_ACTION.REMOVE_SIGN, needUsers: true },
  { label: '抄送', value: FLOW_ACTION.CC, needUsers: true },
  { label: '意见', value: FLOW_ACTION.COMMENT },
  { label: '撤回', value: FLOW_ACTION.WITHDRAW },
  { label: '终止', value: FLOW_ACTION.TERMINATE },
  { label: '退回任意节点', value: FLOW_ACTION.RETURN_ANY, needNode: true },
] as const;

/** 与后端 FlowRuntimeStatus 的两套枚举保持一致，勿混用。 */
export const FLOW_ORDER_STATUS = [
  { label: '运行中', value: 0 },
  { label: '已挂起', value: 1 },
  { label: '已完成', value: 2 },
  { label: '已驳回', value: 3 },
  { label: '已撤回', value: 4 },
  { label: '已终止', value: 5 },
  { label: '暂存待审', value: 6 },
] as const;

export const FLOW_TASK_STATUS = [
  { label: '待办', value: 0 },
  { label: '办理中', value: 1 },
  { label: '已完成', value: 2 },
  { label: '已驳回', value: 3 },
  { label: '已退回', value: 4 },
  { label: '已转办', value: 5 },
  { label: '已委派', value: 6 },
  { label: '已取消', value: 7 },
  { label: '已挂起', value: 8 },
] as const;
