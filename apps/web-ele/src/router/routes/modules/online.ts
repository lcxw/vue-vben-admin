import type { RouteRecordRaw } from 'vue-router';

/**
 * 在线表单模块内置路由。
 *
 * preferences.app.accessMode = 'mixed'：与后端 /menu/all 下发的菜单按 name 合并。
 * 后端菜单种子见 V9__online_form_menu.sql：name 必须与这里一致，
 * component 必须写成 '/online/xxx.vue'，否则 mixed 模式重复菜单 / 404。
 */
const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:clipboard-list',
      order: 46,
      title: '在线表单',
    },
    name: 'Online',
    path: '/online',
    children: [
      {
        meta: { icon: 'lucide:forms', title: '表单管理' },
        name: 'OnlineForm',
        path: 'form',
        component: () => import('#/views/online/form/index.vue'),
      },
      {
        meta: { icon: 'lucide:database', title: '表单数据' },
        name: 'OnlineFormData',
        path: 'data',
        component: () => import('#/views/online/data/index.vue'),
      },
      {
        meta: { icon: 'lucide:book', title: '在线字典' },
        name: 'OnlineDict',
        path: 'dict',
        component: () => import('#/views/online/dict/index.vue'),
      },
      {
        meta: { icon: 'lucide:receipt', title: '工单管理' },
        name: 'OnlineWorkOrder',
        path: 'order',
        component: () => import('#/views/online/order/index.vue'),
      },
      {
        meta: { icon: 'lucide:database-zap', title: '数据源管理' },
        name: 'OnlineDblink',
        path: 'dblink',
        component: () => import('#/views/online/dblink/index.vue'),
      },
      {
        meta: { icon: 'lucide:code', title: '脚本管理' },
        name: 'OnlineScript',
        path: 'script',
        component: () => import('#/views/online/script/index.vue'),
      },
      {
        meta: { icon: 'lucide:network', title: '模型建模' },
        name: 'OnlineModeler',
        path: 'modeler',
        component: () => import('#/views/online/modeler/index.vue'),
      },
    ],
  },
];

export default routes;
