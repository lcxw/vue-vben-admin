/**
 * 流程设计器开发自检页（仅本地联调用，不进入路由与生产构建）。
 *
 * 用途：不依赖登录态，单独挂载 FlowDesigner，验证
 * 1) bpmn-js 样式/图标字体是否生效（palette 是否可点、节点是否成形）；
 * 2) 默认图是否带 DI（画布是否有内容，而不是白板）；
 * 3) 属性面板是否能拿到 modeler（参与人/按钮/变量改动是否真的写进 XML）。
 *
 * 访问：pnpm -F @vben/web-ele exec vite --port 5778 后打开
 * http://localhost:5778/dev-designer.html
 */
import { createApp, h, ref } from 'vue';

import ElementPlus from 'element-plus';
import { createPinia } from 'pinia';

import 'element-plus/dist/index.css';

import FlowDesigner from '../views/flow/designer/FlowDesigner.vue';

const app = createApp({
  name: 'DesignerPreview',
  setup() {
    const xml = ref('');
    return () =>
      h('div', { style: 'height:100vh;padding:12px;box-sizing:border-box' }, [
        h(FlowDesigner, {
          modelValue: xml.value,
          processKey: 'flow_preview',
          processName: '预览流程',
          variables: [
            { showName: '请假天数', variableId: 'v-days', variableName: 'days' },
            { showName: '申请事由', variableId: 'v-reason', variableName: 'reason' },
          ],
          'onUpdate:modelValue': (value: string) => {
            xml.value = value;
            (window as unknown as Record<string, unknown>).__flowXml = value;
          },
        }),
      ]);
  },
});

app.use(createPinia());
app.use(ElementPlus);
app.mount('#app');
