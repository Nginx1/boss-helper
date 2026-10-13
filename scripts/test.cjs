const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const file of ['diagnostics/bridge-recovery.test.cjs','diagnostics/multi-greeting.test.cjs','diagnostics/personal-edition.test.cjs']) {
  const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,stdio:'inherit'});
  if(result.status!==0) {process.exitCode=result.status||1;break;}
}
