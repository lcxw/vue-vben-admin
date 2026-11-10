/**
 * bpmn-js 实例工厂（对齐橙单 WebAdmin 的画布配置）。
 *
 * 关键点（勿改）：
 * 1. **必须引入 bpmn-js 的三份样式**：diagram-js.css 负责画布/palette 布局，
 *    bpmn-js.css 负责节点外观，bpmn-font/bpmn.css 负责 palette 与 context-pad 图标字体。
 *    缺任何一份，画布会出现「没有左侧工具栏 / 拖出来是灰块 / 看不到连线」的现象，
 *    看起来就像设计器不可用。
 * 2. moddleExtensions 必须挂 flowableDescriptor，否则设计器保存 XML 时会丢掉
 *    橙单自定义的 flowable:VariableList / CopyItemList / DeptPostList 等扩展属性；
 * 3. 中文翻译通过 additionalModules 注入，与业务 UI 无关；
 * 4. bpmn-js 18 的类型声明在不同小版本间不完整，这里统一以 any 暴露实例，
 *    把第三方类型问题隔离在本文件，避免污染 Vue 组件的类型检查。
 */
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

// @ts-ignore bpmn-js 18 子路径声明可能缺失，运行时由 Vite 解析
import BpmnModeler from 'bpmn-js/lib/Modeler';
// @ts-ignore 同上
import BpmnViewer from 'bpmn-js/lib/Viewer';

import flowableDescriptor from './descriptor/flowableDescriptor.json';
import createCustomTranslate from './translate/customTranslate';
import translations from './translate/zh';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type BpmnInstance = any;
export type BpmnElement = any;

const translateModule = {
  __init__: ['customTranslate'],
  customTranslate: ['value', createCustomTranslate(translations)],
};

const moddleExtensions = { flowable: flowableDescriptor };

export function createModeler(container: HTMLElement): BpmnInstance {
  return new BpmnModeler({
    additionalModules: [translateModule],
    container,
    // bpmn-js 18 起键盘绑定是隐式的，再传 keyboard.bindTo 会抛
    // 「unsupported configuration <keyboard.bindTo>」，快捷键反而失效 —— 不要加回来。
    moddleExtensions,
  });
}

export function createViewer(container: HTMLElement): BpmnInstance {
  return new BpmnViewer({ container, moddleExtensions });
}

const XMLNS = {
  bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
  dc: 'http://www.omg.org/spec/DD/20100524/DC',
  di: 'http://www.omg.org/spec/DD/20100524/DI',
};

/**
 * 空白流程图（开始 → 审批 → 结束）。
 *
 * **必须带 BPMNDiagram/DI（勿删）**：bpmn-js 只按 DI 渲染图形，只有语义节点没有
 * BPMNShape/BPMNEdge 的 XML 导入后画布是空的。后端
 * FlowEntryService#defaultBpmnXml 与此保持同构。
 */
export function emptyBpmnXml(processKey = 'flow_new', processName = '新流程') {
  const safe = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const key = safe(processKey);
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://lunar-cloud.github.io/bpmn">
  <process id="${key}" name="${safe(processName)}" isExecutable="true">
    <startEvent id="start" name="开始">
      <outgoing>flow1</outgoing>
    </startEvent>
    <userTask id="task1" name="审批">
      <incoming>flow1</incoming>
      <outgoing>flow2</outgoing>
    </userTask>
    <endEvent id="end" name="结束">
      <incoming>flow2</incoming>
    </endEvent>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${key}">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="160" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task1_di" bpmnElement="task1">
        <dc:Bounds x="250" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="402" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="196" y="120"/>
        <di:waypoint x="250" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="350" y="120"/>
        <di:waypoint x="402" y="120"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;
}

const NODE_SIZE: Record<string, [number, number]> = {
  boundaryEvent: [36, 36],
  callActivity: [100, 80],
  complexGateway: [50, 50],
  endEvent: [36, 36],
  eventBasedGateway: [50, 50],
  exclusiveGateway: [50, 50],
  inclusiveGateway: [50, 50],
  intermediateCatchEvent: [36, 36],
  intermediateThrowEvent: [36, 36],
  manualTask: [100, 80],
  parallelGateway: [50, 50],
  receiveTask: [100, 80],
  scriptTask: [100, 80],
  sendTask: [100, 80],
  serviceTask: [100, 80],
  startEvent: [36, 36],
  subProcess: [100, 80],
  task: [100, 80],
  userTask: [100, 80],
};

function sizeOf(localName: string): [number, number] {
  return NODE_SIZE[localName] ?? [100, 80];
}

/**
 * 给缺少图形坐标（BPMNDiagram/DI）的 BPMN XML 补一份自动布局。
 *
 * 场景：后端早期版本生成的默认图、以及部分第三方工具导出的「只有语义没有 DI」的
 * XML。这类 XML 用 bpmn-js 打开就是白板，必须补 DI 才能设计。
 * 布局策略：从开始事件做 BFS 分层，层号决定 x，层内序号决定 y；无法从开始事件
 * 到达的孤立节点排在最后一层，保证不丢节点。
 */
export function ensureDiagramXml(
  xml: string | undefined,
  processKey = 'flow_new',
  processName = '新流程',
): string {
  if (!xml?.trim()) return emptyBpmnXml(processKey, processName);
  if (xml.includes('BPMNDiagram')) return xml;

  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return emptyBpmnXml(processKey, processName);
    }
    const process = Array.from(doc.getElementsByTagName('*')).find(
      (el) => el.localName === 'process',
    );
    if (!process) return emptyBpmnXml(processKey, processName);

    const children = Array.from(process.children);
    const nodes = children.filter(
      (el) =>
        el.localName !== 'sequenceFlow' &&
        el.localName !== 'documentation' &&
        el.localName !== 'extensionElements' &&
        el.localName !== 'laneSet',
    );
    const flows = children.filter((el) => el.localName === 'sequenceFlow');

    const outgoing = new Map<string, string[]>();
    for (const flow of flows) {
      const source = flow.getAttribute('sourceRef');
      const target = flow.getAttribute('targetRef');
      if (!source || !target) continue;
      outgoing.set(source, [...(outgoing.get(source) ?? []), target]);
    }

    const level = new Map<string, number>();
    const queue: string[] = [];
    for (const node of nodes) {
      if (node.localName !== 'startEvent') continue;
      const id = node.getAttribute('id');
      if (id) {
        level.set(id, 0);
        queue.push(id);
      }
    }
    const firstId = nodes[0]?.getAttribute('id');
    if (queue.length === 0 && firstId) {
      level.set(firstId, 0);
      queue.push(firstId);
    }
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const next of outgoing.get(current) ?? []) {
        if (!level.has(next)) {
          level.set(next, (level.get(current) ?? 0) + 1);
          queue.push(next);
        }
      }
    }

    let orphanLevel = Math.max(0, ...level.values()) + 1;
    const perLevelCount = new Map<number, number>();
    const bounds = new Map<
      string,
      { h: number; w: number; x: number; y: number }
    >();
    for (const node of nodes) {
      const id = node.getAttribute('id');
      if (!id) continue;
      if (!level.has(id)) {
        level.set(id, orphanLevel);
        orphanLevel += 1;
      }
      const nodeLevel = level.get(id) as number;
      const index = perLevelCount.get(nodeLevel) ?? 0;
      perLevelCount.set(nodeLevel, index + 1);
      const [w, h] = sizeOf(node.localName);
      bounds.set(id, {
        h,
        w,
        x: 160 + nodeLevel * 180,
        y: 120 + index * 120,
      });
    }

    const ensureNs = (prefix: string, uri: string) => {
      const attr = `xmlns:${prefix}`;
      if (!doc.documentElement.hasAttribute(attr)) {
        doc.documentElement.setAttributeNS(
          'http://www.w3.org/2000/xmlns/',
          attr,
          uri,
        );
      }
    };
    ensureNs('bpmndi', XMLNS.bpmndi);
    ensureNs('dc', XMLNS.dc);
    ensureNs('di', XMLNS.di);

    const diagram = doc.createElementNS(XMLNS.bpmndi, 'bpmndi:BPMNDiagram');
    diagram.setAttribute('id', 'BPMNDiagram_1');
    const plane = doc.createElementNS(XMLNS.bpmndi, 'bpmndi:BPMNPlane');
    plane.setAttribute('id', 'BPMNPlane_1');
    plane.setAttribute('bpmnElement', process.getAttribute('id') ?? processKey);
    diagram.append(plane);

    for (const [id, box] of bounds) {
      const shape = doc.createElementNS(XMLNS.bpmndi, 'bpmndi:BPMNShape');
      shape.setAttribute('id', `${id}_di`);
      shape.setAttribute('bpmnElement', id);
      const rect = doc.createElementNS(XMLNS.dc, 'dc:Bounds');
      rect.setAttribute('x', String(box.x));
      rect.setAttribute('y', String(box.y));
      rect.setAttribute('width', String(box.w));
      rect.setAttribute('height', String(box.h));
      shape.append(rect);
      plane.append(shape);
    }

    for (const flow of flows) {
      const id = flow.getAttribute('id');
      const source = flow.getAttribute('sourceRef');
      const target = flow.getAttribute('targetRef');
      const from = source ? bounds.get(source) : undefined;
      const to = target ? bounds.get(target) : undefined;
      if (!id || !from || !to) continue;
      const edge = doc.createElementNS(XMLNS.bpmndi, 'bpmndi:BPMNEdge');
      edge.setAttribute('id', `${id}_di`);
      edge.setAttribute('bpmnElement', id);
      const points: Array<[number, number]> = [
        [from.x + from.w, from.y + from.h / 2],
        [to.x, to.y + to.h / 2],
      ];
      for (const [x, y] of points) {
        const point = doc.createElementNS(XMLNS.di, 'di:waypoint');
        point.setAttribute('x', String(Math.round(x)));
        point.setAttribute('y', String(Math.round(y)));
        edge.append(point);
      }
      plane.append(edge);
    }

    doc.documentElement.append(diagram);
    return new XMLSerializer().serializeToString(doc);
  } catch (error) {
    console.error('[flow] auto layout failed, fallback to empty diagram', error);
    return emptyBpmnXml(processKey, processName);
  }
}
