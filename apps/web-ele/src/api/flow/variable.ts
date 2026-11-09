import type {
  FlowDesignerVariables,
  FlowIdReq,
  FlowVariableDTO,
  FlowVariableVO,
} from './types';

import { requestClient } from '#/api/request';

const BASE = '/flow/variable';

export function getFlowVariableList(
  entryId: string,
): Promise<FlowVariableVO[]> {
  const req: FlowIdReq = { entryId };
  return requestClient.post<FlowVariableVO[]>(`${BASE}/list`, req);
}

export function getFlowVariable(id: string): Promise<FlowVariableVO> {
  const req: FlowIdReq = { variableId: id };
  return requestClient.post<FlowVariableVO>(`${BASE}/view`, req);
}

export function createFlowVariable(
  data: FlowVariableDTO,
): Promise<FlowVariableVO> {
  return requestClient.post<FlowVariableVO>(`${BASE}/add`, data);
}

export function updateFlowVariable(
  data: FlowVariableDTO,
): Promise<FlowVariableVO> {
  return requestClient.post<FlowVariableVO>(`${BASE}/update`, data);
}

export function deleteFlowVariable(id: string): Promise<void> {
  const req: FlowIdReq = { variableId: id };
  return requestClient.post<void>(`${BASE}/delete`, req);
}

/** 设计器属性面板的变量树（按作用域分组 + 内置变量） */
export function getDesignerVariables(
  entryId: string,
): Promise<FlowDesignerVariables> {
  const req: FlowIdReq = { entryId };
  return requestClient.post<FlowDesignerVariables>(
    `${BASE}/listDesignerVariables`,
    req,
  );
}
