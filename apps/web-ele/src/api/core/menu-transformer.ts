import type { RouteRecordStringComponent } from '@vben/types';

/**
 * 后端 PermissionVO 结构（来自 lunar-cloud system-server MenuController）
 *
 * type: '0'=菜单  '1'=iframe  '2'=外链  '3'=按钮
 */
interface PermissionVO {
  children?: PermissionVO[];
  code?: string;
  component?: string;
  description?: string;
  enabled?: boolean;
  icon?: string;
  id: string;
  name: string;
  openType?: string;
  parentId?: string;
  path?: string;
  sortable?: number;
  type?: string;
  view?: string;
}

/**
 * 将后端 PermissionVO 树转换为前端 RouteRecordStringComponent 树
 *
 * 映射规则：
 * - id          → name（路由名，前端 import.meta.glob 按 component 匹配）
 * - path        → path
 * - component   → component（视图路径，如 "/dashboard/analytics/index"）
 * - description → meta.title
 * - icon        → meta.icon
 * - type='3'    → 按钮，不生成路由
 * - enabled     → 控制 meta.hideInMenu
 * - openType    → 外链时写入 meta.link
 * - children    → 递归转换
 */
export function transformMenuTree(
  permissions: PermissionVO[],
): RouteRecordStringComponent[] {
  return permissions
    .filter((p) => p.type !== '3')
    .map((p) => toRouteRecord(p))
    .filter(Boolean) as RouteRecordStringComponent[];
}

function toRouteRecord(p: PermissionVO): null | RouteRecordStringComponent {
  const children = p.children?.length
    ? transformMenuTree(p.children)
    : undefined;

  const isExternal = p.type === '2';
  const isIframe = p.type === '1';

  const meta: Record<string, any> = {
    order: p.sortable ?? undefined,
    title: p.description || p.name,
  };

  if (p.icon) {
    meta.icon = p.icon;
  }
  if (p.enabled === false) {
    meta.menuVisibleWithForbidden = true;
  }
  if (isExternal && p.openType) {
    meta.link = p.openType;
    meta.hideInMenu = false;
  }
  if (isIframe && p.view) {
    meta.iframeSrc = p.view;
  }

  return {
    children,
    component: isIframe ? 'IFrameView' : (p.component ?? p.view ?? ''),
    meta,
    name: p.name || p.id,
    path: p.path ?? '',
  } as RouteRecordStringComponent;
}
