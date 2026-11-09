/**
 * bpmn-js 实例工厂（对齐橙单 WebAdmin 的画布配置）。
 *
 * 关键点（勿改）：
 * 1. moddleExtensions 必须挂 flowableDescriptor，否则设计器保存 XML 时会丢掉
 *    橙单自定义的 flowable:VariableList / CopyItemList / DeptPostList 等扩展属性；
 * 2. 中文翻译通过 additionalModules 注入，与业务 UI 无关；
 * 3. bpmn-js 18 的类型声明在不同小版本间不完整，这里统一以 any 暴露实例，
 *    把第三方类型问题隔离在本文件，避免污染 Vue 组件的类型检查。
 */
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
    keyboard: { bindTo: document },
    moddleExtensions,
  });
}

export function createViewer(container: HTMLElement): BpmnInstance {
  return new BpmnViewer({ container, moddleExtensions });
}

/** 主流程为空时使用的空白图（后端也会为新流程生成等价的默认图）。 */
export function emptyBpmnXml(processKey = 'flow_new', processName = '新流程') {
  const safe = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://lunar-cloud.github.io/bpmn">
  <process id="${safe(processKey)}" name="${safe(processName)}" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <userTask id="task1" name="审批"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;
}
