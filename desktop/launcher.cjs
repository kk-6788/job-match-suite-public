'use strict';
const {app}=require('electron');
const path=require('node:path');
const resumeMode=process.argv.includes('--resume-workbench');
app.setName(resumeMode?'resume-job-suite-editor':'resume-job-suite-matcher');
app.setPath('userData',path.join(app.getPath('appData'),app.getName()));
if(resumeMode)require('../resume-workbench/desktop/main.cjs');
else require('../job-matcher/desktop.cjs').startStandalone();
