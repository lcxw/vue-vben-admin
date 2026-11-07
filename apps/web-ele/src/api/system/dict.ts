import { requestClient } from '#/api/request';

/** 字典类型 */
export interface DictTypeNode {
  children?: DictTypeNode[];
  code?: string;
  createBy?: string;
  createTime?: string;
  description?: string;
  id: string;
  name?: string;
  parentId?: string;
  sort?: number;
  status?: number;
  updateBy?: string;
  updateTime?: string;
}

/** 字典项 */
export interface DictItemNode {
  code?: string;
  createBy?: string;
  createTime?: string;
  description?: string;
  dictTypeId?: string;
  id: string;
  name?: string;
  sort?: number;
  status?: number;
  updateBy?: string;
  updateTime?: string;
  value?: string;
}

export type DictTypeForm = Partial<DictTypeNode>;
export type DictItemForm = Partial<DictItemNode>;

/** 字典类型树：POST /dict/type/tree */
export function getDictTypeTree(): Promise<DictTypeNode[]> {
  return requestClient.post<DictTypeNode[]>('/dict/type/tree', {});
}

/** 字典类型列表：POST /dict/type/list */
export function getDictTypeList(): Promise<DictTypeNode[]> {
  return requestClient.post<DictTypeNode[]>('/dict/type/list', {});
}

/** 新增字典类型：POST /dict/type/create */
export function createDictType(data: DictTypeForm): Promise<DictTypeNode> {
  return requestClient.post<DictTypeNode>('/dict/type/create', data);
}

/** 编辑字典类型：POST /dict/type/update */
export function updateDictType(data: DictTypeForm): Promise<DictTypeNode> {
  return requestClient.post<DictTypeNode>('/dict/type/update', data);
}

/** 删除字典类型：POST /dict/type/delete */
export function deleteDictType(id: string) {
  return requestClient.post('/dict/type/delete', { id });
}

/** 全量字典项：POST /dict/item/list */
export function getDictItemList(): Promise<DictItemNode[]> {
  return requestClient.post<DictItemNode[]>('/dict/item/list', {});
}

/** 按字典类型 id 查字典项：POST /dict/item/listByType */
export function getDictItemsByType(
  dictTypeId: string,
): Promise<DictItemNode[]> {
  return requestClient.post<DictItemNode[]>('/dict/item/listByType', {
    dictTypeId,
  });
}

/** 按字典编码查字典项：POST /dict/item/listByDictCode */
export function getDictItemsByCode(dictCode: string): Promise<DictItemNode[]> {
  return requestClient.post<DictItemNode[]>('/dict/item/listByDictCode', {
    dictCode,
  });
}

/** 新增字典项：POST /dict/item/create */
export function createDictItem(data: DictItemForm): Promise<DictItemNode> {
  return requestClient.post<DictItemNode>('/dict/item/create', data);
}

/** 编辑字典项：POST /dict/item/update */
export function updateDictItem(data: DictItemForm): Promise<DictItemNode> {
  return requestClient.post<DictItemNode>('/dict/item/update', data);
}

/** 删除字典项：POST /dict/item/delete */
export function deleteDictItem(id: string) {
  return requestClient.post('/dict/item/delete', { id });
}

/** 切换字典项状态：POST /dict/item/updateStatus */
export function updateDictItemStatus(id: string, status: number) {
  return requestClient.post('/dict/item/updateStatus', { id, status });
}
