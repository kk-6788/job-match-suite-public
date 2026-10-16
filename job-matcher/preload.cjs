'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('jobDesktop',Object.freeze({
  aiLocalService:()=>ipcRenderer.invoke('jobmatch:ai-local-service'),
  aiPreview:args=>ipcRenderer.invoke('jobmatch:ai-preview',args),
  aiAnalyze:args=>ipcRenderer.invoke('jobmatch:ai-analyze',args),
  aiCancel:()=>ipcRenderer.invoke('jobmatch:ai-cancel'),
  initial:()=>ipcRenderer.invoke('jobmatch:initial'),
  search:args=>ipcRenderer.invoke('jobmatch:search',args),
  cancel:()=>ipcRenderer.invoke('jobmatch:cancel'),
  openSource:key=>ipcRenderer.invoke('jobmatch:open-source',key),
  collect:args=>ipcRenderer.invoke('jobmatch:collect',args),
  openExternal:url=>ipcRenderer.invoke('jobmatch:external',url),
  onProgress:fn=>{const listener=(_event,value)=>fn(value);ipcRenderer.on('jobmatch:progress',listener);return()=>ipcRenderer.removeListener('jobmatch:progress',listener);}
}));
