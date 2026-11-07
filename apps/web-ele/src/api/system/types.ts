/**
 * lunar-cloud system-server 权限管理前端类型定义。
 *
 * 后端统一响应 Result<T>（code/data/msg）已由 #/api/request 的
 * defaultResponseInterceptor 解包，业务代码拿到的就是 data 本体，
 * 因此这里只描述 data 的形状，不再重复包一层 Result。
 */

/** MyBatis-Plus Page<T> 序列化后的形状 */
export interface BackendPage<T> {
  current?: number;
  orders?: unknown[];
  pages?: number;
  records: T[];
  size?: number;
  total: number;
}

/**
 * vxe-grid 的分页协议。
 *
 * adapter/vxe-table.ts 全局配置了 proxyConfig.response：
 * result/list = 'items'、total = 'total'。后端给的是 records/total，
 * 所以在 API 层统一转换一次，页面无需逐个覆盖 proxyConfig.response。
 */
export interface GridPage<T> {
  items: T[];
  total: number;
}

/** 后端分页 → vxe-grid 分页 */
export function toGridPage<T>(
  page?: null | Partial<BackendPage<T>>,
): GridPage<T> {
  const records = page?.records;
  return {
    items: Array.isArray(records) ? records : [],
    total: page?.total ?? 0,
  };
}

/** 非分页列表 → vxe-grid 分页（树形/全量列表场景） */
export function toGridList<T>(list?: null | T[]): GridPage<T> {
  const items = Array.isArray(list) ? list : [];
  return { items, total: items.length };
}

/** 通用树节点约束 */
export interface TreeNode {
  [key: string]: unknown;
  children?: TreeNode[];
}

/** 分页查询基类（后端 BasePageQuery，页码从 1 开始） */
export interface PageQuery {
  pageNum: number;
  pageSize: number;
}
