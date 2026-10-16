'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('resumeDesktop',Object.freeze({openMatcher:profile=>ipcRenderer.invoke('resume:open-matcher',profile),chat:args=>ipcRenderer.invoke('resume:chat',args),listModels:args=>ipcRenderer.invoke('resume:models',args),printPDF:args=>ipcRenderer.invoke('resume:print-pdf',args),saveConfig:config=>ipcRenderer.invoke('resume:save-config',config),loadConfig:()=>ipcRenderer.invoke('resume:load-config')}));

