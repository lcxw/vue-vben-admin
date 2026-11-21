import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { ElMessage } from 'element-plus';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

/**
 * 页面组件表。
 *
 * import.meta.glob 是「编译期快照」：dev server 在新增视图文件之前启动的话，
 * 快照里就没有这些新文件，后端菜单下发的 component 会解析成 404 页
 * （generate-routes-backend.ts: "route component is invalid"）。
 *
 * 这里对在线表单模块的视图额外做显式动态 import —— 真实 import() 会在模块
 * 重编译时被 Vite 重新解析，不受旧 glob 快照影响。key 直接用归一化后的
 * /online/xxx/index.vue 形态（normalizeViewPath 对该形态是恒等变换）。
 */
const onlinePageImports: ComponentRecordType = {
  '/online/form/index.vue': () => import('#/views/online/form/index.vue'),
  '/online/form/design.vue': () => import('#/views/online/form/design.vue'),
  '/online/dict/index.vue': () => import('#/views/online/dict/index.vue'),
  '/online/order/index.vue': () => import('#/views/online/order/index.vue'),
  '/online/dblink/index.vue': () => import('#/views/online/dblink/index.vue'),
  '/online/script/index.vue': () => import('#/views/online/script/index.vue'),
  // 低代码运行时组件（菜单 bind_type=1 的 component 指向这里）
  '/online/run/OnlineFormRun.vue': () =>
    import('#/views/online/run/OnlineFormRun.vue'),
};

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = {
    ...import.meta.glob('../views/**/*.vue'),
    ...onlinePageImports,
  };

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      ElMessage({
        duration: 1500,
        message: `${$t('common.loadingMenu')}...`,
      });
      return await getAllMenusApi();
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
