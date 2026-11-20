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
  /** 菜单绑定类型：0-普通路由 1-在线表单页面（低代码） */
  bindType?: number;
  /** 绑定的在线表单 Id（bindType=1 时） */
  onlineFormId?: string;
  /** 扩展 JSON */
  extraData?: string;
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
  let path = p.path ?? '';
  let component = p.component ?? p.view ?? '';
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
  // 在线表单菜单（低代码页面）：透传绑定信息，供路由守卫/运行时组件使用
  if (p.bindType === 1 && p.onlineFormId) {
    meta.bindType = 1;
    meta.onlineFormId = p.onlineFormId;
    // 运行时路由固定指向通用组件 OnlineFormRun，formId 走 query
    component = '/online/run/OnlineFormRun.vue';
    path = `run/${p.onlineFormId}`;
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
    component: isIframe ? 'IFrameView' : component,
    meta,
    name: p.name || p.id,
    path,
  } as RouteRecordStringComponent;
}
