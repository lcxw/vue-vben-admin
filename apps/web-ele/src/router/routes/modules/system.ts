import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/**
 * 权限管理模块内置路由。
 *
 * preferences.app.accessMode = 'mixed'，会与后端 /menu/all 下发的菜单按 name 合并：
 * 后端 permission 表里还没有这些页面时，内置路由仍然可见，避免登录后 404。
 * 后端补齐菜单数据后，同 name 的路由以后端为准（meta 会被合并覆盖）。
 *
 * 按钮级权限不写在这里，由页面内部 usePermission().has('模块:操作') 判断。
 */
const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:shield-check',
      order: 20,
      title: $t('system.title'),
    },
    name: 'System',
    path: '/system',
    children: [
      {
        meta: { icon: 'lucide:users', title: $t('system.user') },
        name: 'SystemUser',
        path: 'user',
        component: () => import('#/views/system/user/index.vue'),
      },
      {
        meta: { icon: 'lucide:user-cog', title: $t('system.role') },
        name: 'SystemRole',
        path: 'role',
        component: () => import('#/views/system/role/index.vue'),
      },
      {
        meta: { icon: 'lucide:building-2', title: $t('system.organization') },
        name: 'SystemOrganization',
        path: 'organization',
        component: () => import('#/views/system/organization/index.vue'),
      },
      {
        meta: { icon: 'lucide:network', title: $t('system.department') },
        name: 'SystemDepartment',
        path: 'department',
        component: () => import('#/views/system/department/index.vue'),
      },
      {
        meta: { icon: 'lucide:menu', title: $t('system.menu') },
        name: 'SystemMenu',
        path: 'menu',
        component: () => import('#/views/system/menu/index.vue'),
      },
      {
        meta: { icon: 'lucide:key-round', title: $t('system.permission') },
        name: 'SystemPermission',
        path: 'permission',
        component: () => import('#/views/system/permission/index.vue'),
      },
      {
        meta: { icon: 'lucide:app-window', title: $t('system.client') },
        name: 'SystemClient',
        path: 'client',
        component: () => import('#/views/system/client/index.vue'),
      },
      {
        meta: { icon: 'lucide:badge-check', title: $t('system.scope') },
        name: 'SystemScope',
        path: 'scope',
        component: () => import('#/views/system/scope/index.vue'),
      },
      {
        meta: { icon: 'lucide:briefcase', title: $t('system.post') },
        name: 'SystemPost',
        path: 'post',
        component: () => import('#/views/system/post/index.vue'),
      },
      {
        meta: { icon: 'lucide:book-open', title: $t('system.dict') },
        name: 'SystemDict',
        path: 'dict',
        component: () => import('#/views/system/dict/index.vue'),
      },
      {
        meta: { icon: 'lucide:activity', title: $t('system.online') },
        name: 'SystemOnline',
        path: 'online',
        component: () => import('#/views/system/online/index.vue'),
      },
      {
        meta: { icon: 'lucide:scroll-text', title: $t('system.log') },
        name: 'SystemLog',
        path: 'log',
        component: () => import('#/views/system/log/index.vue'),
      },
    ],
  },
];

export default routes;
