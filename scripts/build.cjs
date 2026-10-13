const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {personalizeBoss, replaceOnce} = require('../src/edition.cjs');
const {logoSVG, maskSVG, dataURI, iconPNG} = require('./icons.cjs');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function build(outDir = root) {
  outDir=path.resolve(outDir);
  const project=JSON.parse(read('src/project.json'));
  assert(/^\d+\.\d+\.\d+$/.test(project.version),'Use a three-part extension version');
  assert(new URL(project.repository).hostname === 'github.com');
  assert(project.feedback.startsWith(project.repository+'/'));
  const baseline=JSON.parse(read('vendor/BASELINE.json'));
  for(const [file,expected] of Object.entries(baseline.sha256)) assert.equal(sha256(read(file)),expected,'Vendor template changed: '+file);
  const metadata={...project,logo:dataURI(logoSVG),maskIcon:dataURI(maskSVG)};
  const projectConfig=replaceOnce(read('src/project-config.js'),'/*@@PROJECT_METADATA@@*/',JSON.stringify(metadata));
  const outputs=new Map();
  for(const [input,output] of [['vendor/boss.template.js','boss.js'],['vendor/background.template.js','background.js'],['vendor/content.template.js','content-scripts/content.js']]) {
    let text=replaceOnce(read(input),'/*@@BRIDGE_HEARTBEAT@@*/',read('src/features/bridge-heartbeat.js').trimEnd());
    if(output==='boss.js') {
      text=replaceOnce(text,'/*@@WORKFLOW_SAFETY@@*/',read('src/features/workflow-safety.js').trimEnd());
      text=personalizeBoss(text,{projectConfig,versionPanel:read('src/ui/version-panel.js'),appMenu:read('src/ui/app-menu.js')});
    }
    text=text.replaceAll('[BOSS Helper]', '['+project.name+']');
    text='/*! '+project.name+' v'+project.version+' | Personal maintenance: '+project.maintainer+' | See LICENSE and NOTICE */\n'+text;
    new vm.Script(text,{filename:output});
    assert(!text.includes('/*@@'),'Unexpanded build placeholder');
    outputs.set(output,Buffer.from(text));
  }
  const manifest=JSON.parse(read('vendor/manifest.base.json'));
  Object.assign(manifest,{version:project.version,version_name:project.versionName,homepage_url:project.repository});
  outputs.set('manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
  for(const [locale,name,description] of [['zh_CN',project.name,project.description],['en',project.nameEN,project.descriptionEN]]) {
    outputs.set('_locales/'+locale+'/messages.json',Buffer.from(JSON.stringify({extName:{message:name},extDescription:{message:description}},null,2)+'\n'));
  }
  for(const [input,output] of [['src/assets/boss.css','assets/boss.css'],['src/assets/content.css','content-scripts/content.css']]) outputs.set(output,Buffer.from(read(input)));
  for(const size of [16,32,48,64,128,256]) outputs.set('icons/'+size+'.png',iconPNG(size));
  outputs.set('icons/logo.png',iconPNG(256));
  outputs.set('icons/logo.svg',Buffer.from(logoSVG+'\n'));
  for(const file of ['LICENSE','NOTICE','PRIVACY.md']) outputs.set(file,Buffer.from(read(file)));
  outputs.set('INSTALL.md',Buffer.from(read('docs/install.md')));
  outputs.set('version-info.json',Buffer.from(JSON.stringify({name:project.name,version:project.version,maintainer:project.maintainer,repository:project.repository,releaseDate:project.releaseDate,remoteAnnouncements:false},null,2)+'\n'));
  const checksums=Object.fromEntries([...outputs].map(([file,bytes])=>[file,sha256(bytes)]));
  outputs.set('checksums.json',Buffer.from(JSON.stringify(checksums,null,2)+'\n'));
  for(const [file,bytes] of outputs) {
    const destination=path.join(outDir,file);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,bytes);
  }
  return {root:outDir,project,files:[...outputs.keys()]};
}
if(require.main===module) {
  const args=process.argv.slice(2);
  assert(args.length===0 || (args.length===2&&args[0]==='--out'),'Usage: node scripts/build.cjs [--out DIRECTORY]');
  const result=build(args[0]?args[1]:root);
  console.log('Built '+result.project.name+' v'+result.project.version+' ('+result.files.length+' files) in '+result.root);
}
module.exports={build,root,read,sha256};
