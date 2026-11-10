/**
 * 已发布流程图查看器开发自检页（仅本地联调用，不进入路由与生产构建）。
 *
 * 用途：单独挂载 FlowViewer，验证「查看已发布版本的流程图」这条路：
 * 1) 有 DI 的 XML 能正常渲染；
 * 2) 历史版本里没有 DI 的 XML 会被 ensureDiagramXml 自动补布局（否则弹窗是白板）。
 *
 * 访问：http://localhost:5778/dev-viewer.html?entry=<entryId>&token=<access_token>
 * 不传 entry 时用内置的「无 DI」样例 XML 验证自动布局。
 */
import { createApp, h, onMounted, ref } from 'vue';

import ElementPlus from 'element-plus';
import { createPinia } from 'pinia';
import { useAccessStore } from '@vben/stores';

import 'element-plus/dist/index.css';

import FlowViewer from '../views/flow/designer/FlowViewer.vue';

const params = new URLSearchParams(window.location.search);
const entryId = params.get('entry') ?? '';
const publishId = params.get('publish') ?? '';
const token = params.get('token') ?? '';

/** 只有语义、没有 BPMNDiagram 的旧数据样例 */
const LEGACY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://lunar-cloud.github.io/bpmn">
  <process id="flow_legacy" name="旧数据无DI" isExecutable="true">
    <startEvent id="start" name="开始"><outgoing>f1</outgoing></startEvent>
    <userTask id="t1" name="主管审批"><incoming>f1</incoming><outgoing>f2</outgoing></userTask>
    <endEvent id="end" name="结束"><incoming>f2</incoming></endEvent>
    <sequenceFlow id="f1" sourceRef="start" targetRef="t1"/>
    <sequenceFlow id="f2" sourceRef="t1" targetRef="end"/>
  </process>
</definitions>`;

const app = createApp({
  name: 'ViewerPreview',
  setup() {
    const xml = ref(params.get('xml') === 'legacy' ? LEGACY_XML : '');
    const title = ref('流程图查看');

    onMounted(async () => {
      if (xml.value) return;
      // 优先验证「已发布版本快照」这条真实链路（VersionDialog 的 onView 走的就是它）
      if (publishId) {
        const { getFlowPublishBpmn } = await import('../api/flow');
        xml.value = await getFlowPublishBpmn(publishId);
        title.value = '已发布版本流程图';
        return;
      }
      if (!entryId) return;
      const { getFlowEntry } = await import('../api/flow');
      const detail = await getFlowEntry(entryId);
      xml.value = detail.bpmnXml ?? '';
      title.value = detail.processDefinitionName ?? '流程图查看';
    });

    return () =>
      h('div', { style: 'height:100vh;padding:12px;box-sizing:border-box' }, [
        h(FlowViewer, {
          modelValue: true,
          title: title.value,
          xml: xml.value,
        }),
      ]);
  },
});

// 注入登录态：查看已发布版本走 /flow/publish/viewBpmn 等接口
// 必须先激活 pinia，否则 useAccessStore() 会抛 getActivePinia was called...
const pinia = createPinia();
app.use(pinia);
const accessStore = useAccessStore();
accessStore.setAccessToken(token);
accessStore.setRefreshToken(token);
accessStore.setAccessCodes(['flow:entry:view', 'flow:publish:list']);

app.use(ElementPlus);
app.mount('#app');
