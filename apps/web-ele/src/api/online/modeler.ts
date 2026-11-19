import type { OnlineFormVO } from './types';
import { requestClient } from '#/api/request';

const BASE = '/online/modeler';

export interface ModelDatasource {
  dsId?: string;
  code: string;
  name: string;
  dblinkCode?: string;
  remark?: string;
  enabled?: number;
}
export interface ModelTable {
  tableModelId?: string;
  dsId: string;
  tableName: string;
  tableComment?: string;
  primaryKey?: string;
  logicDeleteCol?: string;
  sortCol?: string;
  idStrategy?: string;
  enabled?: number;
}
export interface ModelColumn {
  columnModelId?: string;
  tableModelId: string;
  columnName: string;
  columnComment?: string;
  dataType?: string;
  widgetType?: string;
  dictCode?: string;
  isPk?: number;
  isNullable?: number;
  isVirtual?: number;
  defaultValue?: string;
  showOrder?: number;
  enabled?: number;
}
export interface ModelEdge {
  edgeId?: string;
  edgeName?: string;
  fromTableId: string;
  fromColumn: string;
  toTableId: string;
  toColumn: string;
  cardinality?: string;
  joinType?: string;
  direction?: string;
  alias?: string;
  enabled?: number;
}

export const getModelDatasources = (): Promise<ModelDatasource[]> =>
  requestClient.post(`${BASE}/ds/list`, {});
export const saveModelDatasource = (data: ModelDatasource): Promise<ModelDatasource> =>
  requestClient.post(`${BASE}/ds/save`, data);

export const getModelTables = (dsId: string): Promise<ModelTable[]> =>
  requestClient.post(`${BASE}/table/list`, { dsId });
export const saveModelTable = (data: ModelTable): Promise<ModelTable> =>
  requestClient.post(`${BASE}/table/save`, data);
export const deleteModelTable = (tableModelId: string): Promise<void> =>
  requestClient.post(`${BASE}/table/delete`, { tableModelId });

export const getModelColumns = (tableModelId: string): Promise<ModelColumn[]> =>
  requestClient.post(`${BASE}/column/list`, { tableModelId });
export const saveModelColumn = (data: ModelColumn): Promise<ModelColumn> =>
  requestClient.post(`${BASE}/column/save`, data);

export const getModelEdges = (dsId: string): Promise<ModelEdge[]> =>
  requestClient.post(`${BASE}/edge/list`, { dsId });
export const saveModelEdge = (data: ModelEdge): Promise<ModelEdge> =>
  requestClient.post(`${BASE}/edge/save`, data);
export const deleteModelEdge = (edgeId: string): Promise<void> =>
  requestClient.post(`${BASE}/edge/delete`, { edgeId });

export const updateFormStorage = (data: {
  formId: string;
  storageType: number;
  anchorTableId?: string;
  datasourceId?: string;
  graphMaxDepth?: number;
}): Promise<OnlineFormVO> =>
  requestClient.post('/online/form/update', data);

export function queryModelData(data: {
  formId: string;
  filters?: Record<string, unknown>;
  pageNum?: number;
  pageSize?: number;
}): Promise<Record<string, unknown>> {
  return requestClient.post('/online/model-data/query', data);
}
