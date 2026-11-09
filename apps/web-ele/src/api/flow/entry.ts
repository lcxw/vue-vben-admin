import type {
  FlowEntryDTO,
  FlowEntryQuery,
  FlowEntryVO,
  FlowIdReq,
  FlowPublishVO,
  FlowSaveDraftReq,
  FlowTaskExtVO,
} from './types';

import { requestClient } from '#/api/request';
import type { BackendPage } from '#/api/system/types';
import { toGridPage } from '#/api/system/types';

const BASE = '/flow/entry';

/** 流程定义分页（后端 MyBatis-Plus Page → vxe-grid 协议） */
export async function getFlowEntryPage(params: FlowEntryQuery) {
  const page = await requestClient.post<BackendPage<FlowEntryVO>>(
    `${BASE}/list`,
    params,
  );
  return toGridPage(page);
}

export function getFlowEntryList(): Promise<FlowEntryVO[]> {
  return requestClient.post<FlowEntryVO[]>(`${BASE}/listAll`, {});
}

export function getFlowEntryDict(): Promise<
  { id: string; key: string; name: string }[]
> {
  return requestClient.post(`${BASE}/listDict`, {});
}

/** 可发起的流程（已发布且有激活主版本） */
export function getStartableFlowList(): Promise<FlowEntryVO[]> {
  return requestClient.post<FlowEntryVO[]>(`${BASE}/listAllByStartFlow`, {});
}

export function getFlowEntry(entryId: string): Promise<FlowEntryVO> {
  const req: FlowIdReq = { entryId };
  return requestClient.post<FlowEntryVO>(`${BASE}/view`, req);
}

export function createFlowEntry(data: FlowEntryDTO): Promise<FlowEntryVO> {
  return requestClient.post<FlowEntryVO>(`${BASE}/add`, data);
}

export function updateFlowEntry(data: FlowEntryDTO): Promise<FlowEntryVO> {
  return requestClient.post<FlowEntryVO>(`${BASE}/update`, data);
}

export function deleteFlowEntry(entryId: string): Promise<void> {
  const req: FlowIdReq = { entryId };
  return requestClient.post<void>(`${BASE}/delete`, req);
}

/**
 * 保存设计器草稿：只写 bpmn_xml，不产生版本。
 * 意图（勿改）：与 publish 严格分离，画布保存不等于发布。
 */
export function saveFlowDraft(data: FlowSaveDraftReq): Promise<FlowEntryVO> {
  return requestClient.post<FlowEntryVO>(`${BASE}/saveDraft`, data);
}

// ---------------- 发布与版本 ----------------

/** 发布新版本（调用 Flowable deploy，返回新版本记录） */
export function publishFlowEntry(entryId: string): Promise<FlowPublishVO> {
  const req: FlowIdReq = { entryId };
  return requestClient.post<FlowPublishVO>(`${BASE}/publish`, req);
}

export function getFlowPublishList(
  entryId: string,
): Promise<FlowPublishVO[]> {
  const req: FlowIdReq = { entryId };
  return requestClient.post<FlowPublishVO[]>(`${BASE}/listPublish`, req);
}

export function setFlowMainVersion(
  entryId: string,
  newEntryPublishId: string,
): Promise<void> {
  const req: FlowIdReq = { entryId, newEntryPublishId };
  return requestClient.post<void>(`${BASE}/updateMainVersion`, req);
}

export function suspendFlowPublish(
  entryPublishId: string,
): Promise<FlowPublishVO> {
  const req: FlowIdReq = { entryPublishId };
  return requestClient.post<FlowPublishVO>(`${BASE}/suspendPublish`, req);
}

export function activateFlowPublish(
  entryPublishId: string,
): Promise<FlowPublishVO> {
  const req: FlowIdReq = { entryPublishId };
  return requestClient.post<FlowPublishVO>(`${BASE}/activatePublish`, req);
}

/** 查看指定版本的 BPMN XML（读版本快照） */
export function getFlowPublishBpmn(entryPublishId: string): Promise<string> {
  return requestClient.get<string>(`${BASE}/viewBpmn`, {
    params: { entryPublishId },
  });
}

/** 导入 BPMN XML 到草稿 */
export function uploadFlowBpmn(
  entryId: string,
  bpmnXml: string,
): Promise<FlowEntryVO> {
  return requestClient.post<FlowEntryVO>(`${BASE}/upload`, {
    bpmnXml,
    entryId,
  });
}

/** 导出当前草稿 BPMN XML */
export function downloadFlowBpmn(entryId: string): Promise<string> {
  return requestClient.get<string>(`${BASE}/download`, {
    params: { entryId },
  });
}

export function getFlowTaskExtList(
  entryPublishId: string,
): Promise<FlowTaskExtVO[]> {
  const req: FlowIdReq = { entryPublishId };
  return requestClient.post<FlowTaskExtVO[]>(`${BASE}/listTaskExt`, req);
}
