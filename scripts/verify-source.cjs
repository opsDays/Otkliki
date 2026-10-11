const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const expected=JSON.parse(fs.readFileSync(path.join(root,'SOURCE_SHA256.json'),'utf8'));
let count=0;
for(const [relative,wanted] of Object.entries(expected)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex');
 if(actual!==wanted)throw Error('Source has changed: '+relative);
 count++;
}
console.log(count+' original application files match the exported 1.4 source snapshot.');
console.log('This checks file consistency, not software safety or the identity of its publisher.');
