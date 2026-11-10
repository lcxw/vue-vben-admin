/**
 * 流程设计页（DesignerPage）开发自检页。
 *
 * 目的：不经过登录流程，直接以真实 token 挂载「基础信息 / 变量 / 审批状态 / 流程设计」
 * 四步向导，端到端验证：
 *   1) 页面能否把后端草稿 XML 交给 bpmn-js 并渲染；
 *   2) 从「基础信息」切到「流程设计」时画布能否重新测量尺寸（这是白板问题的关键路径）；
 *   3) 保存草稿能否写回后端。
 *
 * 访问：http://localhost:5778/dev-designer-page.html?entry=<entryId>&token=<access_token>
 * 仅本地联调用，不进入路由与生产构建。
 */
import { createApp, h } from 'vue';

import ElementPlus from 'element-plus';
import { createPinia } from 'pinia';
import { useAccessStore } from '@vben/stores';
import {
  createRouter,
  createWebHashHistory,
  RouterView,
} from 'vue-router';

import 'element-plus/dist/index.css';

const params = new URLSearchParams(window.location.search);
const entryId = params.get('entry') ?? '';
const token = params.get('token') ?? '';

const pinia = createPinia();

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: { render: () => h(RouterView) },
      children: [
        {
          path: '',
          redirect: `/flow/entry/design/${entryId}`,
        },
        {
          path: '/flow/entry/design/:id',
          name: 'FlowEntryDesign',
          component: () => import('../views/flow/entry/DesignerPage.vue'),
        },
        {
          path: '/flow/entry',
          name: 'FlowEntry',
          component: { render: () => h('div', '流程列表占位') },
        },
      ],
    },
  ],
});

const app = createApp({ render: () => h(RouterView) });
app.use(pinia);
app.use(ElementPlus);
app.use(router);

// 必须在 router 挂载前注入登录态：requestClient 会从 access store 取 Bearer
const accessStore = useAccessStore();
accessStore.setAccessToken(token);
accessStore.setRefreshToken(token);
accessStore.setAccessCodes([
  'flow:entry:list',
  'flow:entry:view',
  'flow:entry:add',
  'flow:entry:update',
  'flow:entry:remove',
  'flow:entry:publish',
  'flow:variable:list',
  'flow:variable:add',
  'flow:variable:update',
  'flow:variable:remove',
  'flow:publish:list',
  'flow:publish:main',
  'flow:publish:suspend',
  'flow:publish:activate',
  'flow:identity:list',
  'flow:category:list',
]);

router.isReady().then(() => app.mount('#app'));
