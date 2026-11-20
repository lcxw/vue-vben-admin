import type { RouteRecordRaw } from 'vue-router';

/**
 * 在线表单模块内置路由（v3 收敛后：设计器为主入口 + 支撑页 + 运行时）。
 *
 * preferences.app.accessMode = 'mixed'：与后端 /menu/all 下发的菜单按 name 合并。
 * 后端菜单 component 必须写成 '/online/xxx/index.vue' 形态才能命中 pageMap。
 *
 * v3 说明：
 * - 旧版割裂页面（表单管理/表单数据/页面编排/数据工作台/模型建模）已从菜单下线
 *   （V21 enabled=0），运行入口统一收敛到唯一运行时组件 OnlineFormRun；
 * - 保留支撑页：字典/数据源/分类/工单/脚本；
 * - OnlineFormRun 为低代码页面的唯一运行时入口（hideInMenu，由菜单 bind_type=1 跳转，
 *   formId 来自 route.meta.onlineFormId 或 query）。
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
        meta: { icon: 'lucide:workflow', title: '页面设计' },
        name: 'OnlineDesigner',
        path: 'designer',
        component: () => import('#/views/online/designer/index.vue'),
      },
      {
        meta: { icon: 'lucide:book', title: '在线字典' },
        name: 'OnlineDict',
        path: 'dict',
        component: () => import('#/views/online/dict/index.vue'),
      },
      {
        meta: { icon: 'lucide:folder-tree', title: '表单分类' },
        name: 'OnlineCategory',
        path: 'category',
        component: () => import('#/views/online/category/index.vue'),
      },
      {
        meta: { icon: 'lucide:database-zap', title: '数据源管理' },
        name: 'OnlineDblink',
        path: 'dblink',
        component: () => import('#/views/online/dblink/index.vue'),
      },
      {
        meta: { icon: 'lucide:receipt', title: '工单管理' },
        name: 'OnlineWorkOrder',
        path: 'order',
        component: () => import('#/views/online/order/index.vue'),
      },
      {
        meta: { icon: 'lucide:code', title: '脚本管理' },
        name: 'OnlineScript',
        path: 'script',
        component: () => import('#/views/online/script/index.vue'),
      },
      /** 在线表单运行时（低代码页面通用入口；由菜单 bind_type=1 跳转，不在菜单显示） */
      {
        meta: { hideInMenu: true, title: '在线表单' },
        name: 'OnlineFormRun',
        path: 'form-run',
        component: () => import('#/views/online/run/OnlineFormRun.vue'),
      },
    ],
  },
];

export default routes;
