import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/**
 * 流程配置模块内置路由。
 *
 * preferences.app.accessMode = 'mixed'：与后端 /menu/all 下发的菜单按 name 合并，
 * 后端 permission 表还没补节点时内置路由仍可见（菜单种子见
 * backend/.../workflow-server/src/main/resources/sql/V2__flow_menu_permission.sql）。
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
        meta: { icon: 'lucide:inbox', title: $t('flow.todo') },
        name: 'FlowTodo',
        path: 'task/todo',
        component: () => import('#/views/flow/task/TodoPage.vue'),
      },
      {
        meta: { icon: 'lucide:circle-check', title: $t('flow.done') },
        name: 'FlowDone',
        path: 'task/done',
        component: () => import('#/views/flow/task/DonePage.vue'),
      },
      {
        meta: { icon: 'lucide:send', title: $t('flow.mine') },
        name: 'FlowMine',
        path: 'runtime/mine',
        component: () => import('#/views/flow/runtime/MinePage.vue'),
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
