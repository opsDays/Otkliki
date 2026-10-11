const path=require('node:path');
function portableRoot(executable,platform,override,pathApi=path){
 if(override)return override;
 const executableDir=pathApi.dirname(executable);
 // macOS executable is inside Otkliki.app/Contents/MacOS. Keep data beside .app.
 return platform==='darwin'?pathApi.resolve(executableDir,'../../..'):executableDir;
}
module.exports={portableRoot};
