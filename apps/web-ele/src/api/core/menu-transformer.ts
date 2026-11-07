import type { RouteRecordStringComponent } from '@vben/types';

/**
 * 后端 PermissionVO 结构（来自 lunar-cloud system-server MenuController）
 *
 * 注意 type 有两套历史编码：
 * - 存量 MySQL 数据：'MENU' / 'BUTTON'，iframe 用 open_type='_iframe'，
 *   外链用 open_type 或 path 存 http(s) 链接；
 * - 权限管理页内部：'0'=菜单 / '1'=iframe / '2'=外链 / '3'=按钮。
 * 这里两种都兼容，避免把 BUTTON 当菜单生成路由、或把外链当内嵌页渲染。
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

function isButtonType(p: PermissionVO): boolean {
  const type = (p.type ?? '').toUpperCase();
  return type === '3' || type === 'BUTTON';
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
 * - 按钮        → 不生成路由
 * - enabled     → 控制 meta.menuVisibleWithForbidden
 * - openType    → 外链时写入 meta.link，iframe 时写入 meta.iframeSrc
 * - children    → 递归转换
 */
export function transformMenuTree(
  permissions: PermissionVO[],
): RouteRecordStringComponent[] {
  return (permissions ?? [])
    .filter((p) => !isButtonType(p))
    .map((p) => toRouteRecord(p))
    .filter(Boolean) as RouteRecordStringComponent[];
}

function toRouteRecord(p: PermissionVO): null | RouteRecordStringComponent {
  const children = p.children?.length
    ? transformMenuTree(p.children)
    : undefined;

  const openType = p.openType ?? '';
  const path = p.path ?? '';
  const isIframe =
    p.type === '1' || openType === '_iframe' || Boolean(p.view && !p.component);
  const externalFromOpenType = /^https?:\/\//i.test(openType);
  const externalFromPath = /^https?:\/\//i.test(path);
  const isExternal = p.type === '2' || externalFromOpenType || externalFromPath;

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
  if (isExternal) {
    meta.link = externalFromOpenType
      ? openType
      : openType || path || p.view || '';
    meta.hideInMenu = false;
  }
  if (isIframe) {
    meta.iframeSrc = p.view || openType || path;
  }

  return {
    children,
    component: isIframe ? 'IFrameView' : (p.component ?? p.view ?? ''),
    meta,
    name: p.name || p.id,
    path,
  } as RouteRecordStringComponent;
}
