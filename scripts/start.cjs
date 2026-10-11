const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const electron=require('electron');
const env={...process.env,OTKLIKI_PORTABLE_HOME:path.join(root,'.local-profile')};
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,[path.join(root,'app')],{stdio:'inherit',env});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
