/**
 * 流程运行时 API（workflow-server :20007）。
 *
 * 契约要点（勿改）：
 * 1. 全部 POST + 平铺 DTO，不用橙单 @MyRequestBody 的 {main:{...}} 包裹；
 * 2. 分页返回 MyBatis-Plus Page（records/total），统一在 API 层转成 vxe-grid 的
 *    items/total，页面不重复覆盖 proxyConfig.response；
 * 3. 所有办理类动作走 /flow/action/execute 单一入口，由 action 分发并动态鉴权；
 * 4. /flow/monitor/detail 一次返回工单 + 任务 + 意见 + 变量 + 高亮数据 + 版本 XML 快照，
 *    详情抽屉只调这一个接口，避免多请求拼装产生状态不一致。
 */
import type {
  FlowMonitorVO,
  FlowOrderReq,
  FlowStartReq,
  FlowTaskActionReq,
  FlowTaskCommentVO,
  FlowTaskQuery,
  FlowTaskVO,
  FlowWorkOrderVO,
} from './types';

import type { BackendPage } from '#/api/system/types';

import { requestClient } from '#/api/request';
import { toGridPage } from '#/api/system/types';

const RUNTIME = '/flow/runtime';
const ACTION = '/flow/action';
const MONITOR = '/flow/monitor';

// ---------------- 实例生命周期 ----------------

/** 发起流程（draft=true 时只落暂存工单，不启动引擎实例）。 */
export function startFlow(data: FlowStartReq): Promise<FlowWorkOrderVO> {
  return requestClient.post<FlowWorkOrderVO>(`${RUNTIME}/start`, data);
}

/** 暂存待审草稿正式提交。 */
export function submitFlowDraft(workOrderId: string): Promise<FlowWorkOrderVO> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<FlowWorkOrderVO>(`${RUNTIME}/submitDraft`, req);
}

/** 我发起的（分页）。 */
export async function getFlowMinePage(params: FlowTaskQuery) {
  const page = await requestClient.post<BackendPage<FlowWorkOrderVO>>(
    `${RUNTIME}/listMine`,
    params,
  );
  return toGridPage(page);
}

export function getFlowOrder(workOrderId: string): Promise<FlowWorkOrderVO> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<FlowWorkOrderVO>(`${RUNTIME}/view`, req);
}

/** 我的待办（分页）。 */
export async function getFlowTodoPage(params: FlowTaskQuery) {
  const page = await requestClient.post<BackendPage<FlowTaskVO>>(
    `${RUNTIME}/todo`,
    params,
  );
  return toGridPage(page);
}

/** 我的已办（分页）。 */
export async function getFlowDonePage(params: FlowTaskQuery) {
  const page = await requestClient.post<BackendPage<FlowTaskVO>>(
    `${RUNTIME}/done`,
    params,
  );
  return toGridPage(page);
}

export function withdrawFlow(
  workOrderId: string,
  reason?: string,
): Promise<unknown> {
  const req: FlowOrderReq = { reason, workOrderId };
  return requestClient.post<unknown>(`${RUNTIME}/withdraw`, req);
}

export function terminateFlow(
  workOrderId: string,
  reason?: string,
): Promise<unknown> {
  const req: FlowOrderReq = { reason, workOrderId };
  return requestClient.post<unknown>(`${RUNTIME}/terminate`, req);
}

export function suspendFlow(workOrderId: string): Promise<unknown> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<unknown>(`${RUNTIME}/suspend`, req);
}

export function activateFlow(workOrderId: string): Promise<unknown> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<unknown>(`${RUNTIME}/activate`, req);
}

export function jumpFlow(
  workOrderId: string,
  targetNodeId: string,
): Promise<unknown> {
  const req: FlowOrderReq = { targetNodeId, workOrderId };
  return requestClient.post<unknown>(`${RUNTIME}/jump`, req);
}

export function getFlowVariables(
  workOrderId: string,
): Promise<Record<string, unknown>> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<Record<string, unknown>>(
    `${RUNTIME}/variables`,
    req,
  );
}

export function setFlowVariables(
  workOrderId: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const req: FlowOrderReq = { variables, workOrderId };
  return requestClient.post<unknown>(`${RUNTIME}/setVariables`, req);
}

// ---------------- 办理动作 ----------------

/** 统一动作入口：同意/驳回/退回/拿回/转办/加签/抄送/认领等。 */
export function executeFlowAction(data: FlowTaskActionReq): Promise<unknown> {
  return requestClient.post<unknown>(`${ACTION}/execute`, data);
}

export function claimFlowTask(data: FlowTaskActionReq): Promise<unknown> {
  return requestClient.post<unknown>(`${ACTION}/claim`, data);
}

export function urgeFlowTask(data: FlowTaskActionReq): Promise<unknown> {
  return requestClient.post<unknown>(`${ACTION}/urge`, data);
}

// ---------------- 监控 / 审计 ----------------

/** 实例详情 + 流程图高亮 + 审批历史 + 变量 + 版本 XML 快照。 */
export function getFlowMonitorDetail(
  workOrderId: string,
): Promise<FlowMonitorVO> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<FlowMonitorVO>(`${MONITOR}/detail`, req);
}

export function getFlowHistory(
  workOrderId: string,
): Promise<FlowTaskCommentVO[]> {
  const req: FlowOrderReq = { workOrderId };
  return requestClient.post<FlowTaskCommentVO[]>(`${MONITOR}/history`, req);
}

export function getFlowStatistics(
  params?: FlowOrderReq,
): Promise<Record<string, unknown>> {
  return requestClient.post<Record<string, unknown>>(
    `${MONITOR}/statistics`,
    params ?? {},
  );
}

export function getFlowEfficiency(
  entryId?: string,
): Promise<Array<Record<string, unknown>>> {
  return requestClient.get<Array<Record<string, unknown>>>(
    `${MONITOR}/efficiency`,
    { params: { entryId } },
  );
}
