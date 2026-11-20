import{J as e,L as t,On as n}from"./runtime-core.esm-bundler-BqIb1SNH.js";import{n as r,s as i}from"./dist-DYgXaaqu.js";import{t as a}from"./error-Be8TfUjb.js";import{a as o}from"./install-BUKk4mCc.js";var s={prefix:Math.floor(Math.random()*1e4),current:0},c=Symbol(`elIdInjection`),l=()=>t()?e(c,s):s,u=e=>{let t=l();!i&&t===s&&a(`IdInjection`,`Looks like you are using server rendering, you must provide a id provider to ensure the hydration process to be succeed
usage: app.provide(ID_INJECTION_KEY, {
  prefix: number,
  current: number,
})`);let c=o();return r(()=>n(e)||`${c.value}-id-${t.prefix}-${t.current++}`)};export{l as n,u as t};