import type { RouteRecordRaw } from 'vue-router';

/**
 * 在线表单模块内置路由（v4 收敛）：一个「表单中心」入口。
 *
 * - 表单中心：左侧分类树 + 右侧分页列表（新建/设计/发布/复制/删除）；
 * - 设计器：视图 Tab + 字段面板 + 12 栅格画布 + 属性面板（formId 由 query 传入，不在菜单出现）；
 * - 支撑页：字典 / 数据源 / 工单 / 脚本；
 * - 运行时：已发布表单由菜单 bind_type=1 跳到 run/<pageCode>，统一走 OnlineFormRun。
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
        meta: { icon: 'lucide:forms', title: '表单列表' },
        name: 'OnlineForm',
        path: 'form',
        component: () => import('#/views/online/form/index.vue'),
      },
      {
        meta: { hideInMenu: true, title: '表单设计' },
        name: 'OnlineFormDesign',
        path: 'form/design',
        component: () => import('#/views/online/form/design.vue'),
      },
      {
        meta: { icon: 'lucide:book', title: '在线字典' },
        name: 'OnlineDict',
        path: 'dict',
        component: () => import('#/views/online/dict/index.vue'),
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
      /** 已发布表单运行时（菜单 bind_type=1 → run/<pageCode>） */
      {
        meta: { hideInMenu: true, title: '在线表单' },
        name: 'OnlineFormRun',
        path: 'run/:pageCode?',
        component: () => import('#/views/online/run/OnlineFormRun.vue'),
      },
      /** 兼容旧菜单路径 */
      {
        meta: { hideInMenu: true, title: '在线表单' },
        name: 'OnlineFormRunLegacy',
        path: 'form-run',
        component: () => import('#/views/online/run/OnlineFormRun.vue'),
      },
    ],
  },
];

export default routes;
