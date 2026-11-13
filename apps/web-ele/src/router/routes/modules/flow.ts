import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/**
 * 流程模块内置路由。
 *
 * preferences.app.accessMode = 'mixed'：与后端 /menu/all 下发的菜单按 name 合并，
 * 后端菜单的 name 必须与这里的 name 完全一致，否则会生成重复菜单项；
 * component 也必须写成 '/flow/xxx.vue' 形式，否则 generate-routes-backend 会
 * 找不到 pageMap 里的视图、把菜单替换成 404 页。
 * 菜单种子见 backend/.../system-server/src/main/resources/sql/V8__flow_menu_cleanup.sql。
 */
const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:workflow',
      order: 45,
      title: $t('flow.title'),
    },
    name: 'Flow',
    path: '/flow',
    children: [
      {
        meta: { icon: 'lucide:git-branch', title: $t('flow.entry') },
        name: 'FlowEntry',
        path: 'entry',
        component: () => import('#/views/flow/entry/index.vue'),
      },
      {
        meta: {
          activePath: '/flow/entry',
          hideInMenu: true,
          title: $t('flow.design'),
        },
        name: 'FlowEntryDesign',
        path: 'entry/design/:id',
        component: () => import('#/views/flow/entry/DesignerPage.vue'),
      },
      {
        meta: { icon: 'lucide:folder-tree', title: $t('flow.category') },
        name: 'FlowCategory',
        path: 'category',
        component: () => import('#/views/flow/category/index.vue'),
      },
      {
        meta: { icon: 'lucide:send', title: $t('flow.start') },
        name: 'FlowStart',
        path: 'runtime/start',
        component: () => import('#/views/flow/runtime/StartPage.vue'),
      },
      {
        meta: { icon: 'lucide:inbox', title: $t('flow.todo') },
        name: 'FlowTodo',
        path: 'task/todo',
        component: () => import('#/views/flow/task/TodoPage.vue'),
      },
      {
        meta: { icon: 'lucide:hand', title: $t('flow.claim') },
        name: 'FlowClaim',
        path: 'task/claim',
        component: () => import('#/views/flow/task/ClaimPage.vue'),
      },
      {
        meta: { icon: 'lucide:circle-check', title: $t('flow.done') },
        name: 'FlowDone',
        path: 'task/done',
        component: () => import('#/views/flow/task/DonePage.vue'),
      },
      {
        meta: { icon: 'lucide:user-round', title: $t('flow.mine') },
        name: 'FlowMine',
        path: 'runtime/mine',
        component: () => import('#/views/flow/runtime/MinePage.vue'),
      },
      {
        meta: { icon: 'lucide:mail', title: $t('flow.cc') },
        name: 'FlowCc',
        path: 'task/cc',
        component: () => import('#/views/flow/task/CcPage.vue'),
      },
      {
        meta: { icon: 'lucide:user-switch', title: $t('flow.delegate') },
        name: 'FlowDelegate',
        path: 'runtime/delegate',
        component: () => import('#/views/flow/runtime/DelegatePage.vue'),
      },
      {
        meta: { icon: 'lucide:list', title: $t('flow.instance') },
        name: 'FlowInstance',
        path: 'runtime/instances',
        component: () => import('#/views/flow/runtime/InstancePage.vue'),
      },
      {
        meta: { icon: 'lucide:chart-column', title: $t('flow.monitor') },
        name: 'FlowMonitor',
        path: 'monitor',
        component: () => import('#/views/flow/monitor/index.vue'),
      },
    ],
  },
];

export default routes;
