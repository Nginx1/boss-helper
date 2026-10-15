const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {build,root,read,sha256} = require('../scripts/build.cjs');
const {crc32} = require('../scripts/icons.cjs');
const section = (source,start,end) => {
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Missing runtime section: '+start);
  return source.slice(a,b);
};
const source=read('boss.js');
const project=JSON.parse(read('src/project.json'));
assert.equal(JSON.parse(read('package.json')).version,project.version);
const renderNode=(type,props,children)=>({type,props:props||{},children});
const flatten=node=>{
  if(node==null) return [];
  if(Array.isArray(node)) return node.flatMap(flatten);
  if(typeof node==='function') return flatten(node());
  if(typeof node!=='object') return [node];
  if('type' in node) return [node,...flatten(node.children)];
  return Object.entries(node).filter(([key])=>key!=='_').flatMap(([,value])=>flatten(value));
};

async function runtimeChecks() {
  let fetches=0,intervals=0;
  const cleared=[],opened=[],toasts=[],hooks=[],stored=new Map();
  const context=vm.createContext({
    fetch(){fetches++;throw Error('No external project request allowed');},
    setInterval(){intervals++;throw Error('No project polling allowed');},
    clearInterval(id){cleared.push(id);},
    N:value=>({value}),K:fn=>({get value(){return fn();}}),
    Gm:()=>({}),hF:()=>({}),Ph:()=>({}),ku:(value,methods)=>methods,
    dF:class {},Jt:value=>value,
    I:component=>component,R(){},V:renderNode,z:renderNode,H:renderNode,B:renderNode,
    F:fn=>fn,U:text=>text,
    hQ:'Modal',OX:'Link',AX:'Button',BX:'App',XZ:'Dropdown',uX:'Avatar',
    e4:'boss-protocol',t4:'personal-'+project.version,
    Md:{info(){}},Fm:()=>({add:toast=>toasts.push(toast)}),Ai:fn=>hooks.push(fn),
    RX:()=>({create:component=>({open:()=>opened.push(component)})}),
    window:{open:(url,target,features)=>opened.push({url,target,features})},
    iu:{storageGet:async key=>stored.get(key),storageSet:async(key,value)=>stored.set(key,value)},
  });
  vm.runInContext(section(source,'/* Personal edition project metadata', 'var yF=class')+
    section(source,'var yF=class',',bF=Symbol()')+';',context);
  const helper=vm.runInContext('new yF()',context);
  let workflowStops=0,assistantStops=0;
  helper.workflow={stop(){workflowStops++;}};helper._bhAssistant={pause(){assistantStops++;}};
  helper.stop();assert.equal(workflowStops,1);assert.equal(assistantStops,1);
  helper.workflow=null;helper._bhAssistant=null;
  helper.initNetConf();
  assert.equal(helper.netConf.value.version,project.version);
  assert.equal(helper.netConf.value.feedback,project.feedback);
  assert.equal(helper.netConf.value.notification.length,0);
  assert.equal(helper.netConfTimer,null);
  helper.netConfTimer=17;helper.initNetConf();assert.deepEqual(cleared,[17]);
  const config=await context.vF();config.notification.push('local mutation');
  assert.equal((await context.vF()).notification.length,0,'Each caller gets a fresh local configuration');
  assert.equal(fetches,0);assert.equal(intervals,0);
}

async function uiChecks() {
  const hooks=[],opened=[],stored=new Map(),notices=[];
  const context=vm.createContext({
    BHProject:{...project,logo:'data:image/svg+xml;base64,test'},SF:()=>({}),
    I:component=>component,R(){},V:renderNode,z:renderNode,H:renderNode,B:renderNode,F:fn=>fn,U:text=>text,
    hQ:'Modal',OX:'Link',AX:'Button',BX:'App',XZ:'Dropdown',uX:'Avatar',
    N:value=>({value}),Ai:fn=>hooks.push(fn),e4:'boss-protocol',t4:'personal-'+project.version,
    Md:{info(){}},Fm:()=>({add:item=>notices.push(item)}),
    RX:()=>({create:component=>({open:()=>opened.push(component)})}),
    window:{open:(url,target,features)=>opened.push({url,target,features})},
    iu:{storageGet:async key=>stored.get(key),storageSet:async(key,value)=>stored.set(key,value)},
  });
  vm.runInContext('var wQ='+section(source,'wQ=I({',',TQ={slots:').slice(3)+';'+
    'var Sse='+section(source,'Sse=I({',',Cse=`').slice(4)+';',context);
  const closeEvents=[];
  const version=context.wQ.setup({}, {emit:(...args)=>closeEvents.push(args)})();
  const versionNodes=flatten(version),versionText=versionNodes.filter(n=>typeof n==='string').join(' ');
  assert(versionText.includes(project.version)&&versionText.includes(project.maintainer));
  assert.equal(versionNodes.find(n=>n.type==='Link').props.to,project.repository);
  versionNodes.find(n=>n.type==='Button').props.onClick();assert.deepEqual(closeEvents,[['close',false]]);
  const renderMenu=context.Sse.setup();
  await Promise.all(hooks.map(fn=>fn()));
  let menuNodes=flatten(renderMenu());
  const modal=menuNodes.find(n=>n.type==='Modal');assert.equal(modal.props.open,true);
  assert.equal(menuNodes.find(n=>n.type==='Avatar').props.src,context.BHProject.logo);
  const actions=menuNodes.find(n=>n.type==='Dropdown').props.items[1];
  actions[0].onSelect();assert.equal(opened[0],context.wQ);
  actions[1].onSelect();actions[2].onSelect();
  assert.equal(opened[1].url,project.repository);assert.equal(opened[2].url,project.feedback);
  await menuNodes.find(n=>n.type==='Button').props.onClick();
  assert.equal(stored.get('boss-protocol'),'personal-'+project.version);
  assert.equal(flatten(renderMenu()).find(n=>n.type==='Modal').props.open,false);
  assert(notices.some(item=>item.description.includes(project.name)));
}

function generatedChecks() {
  const manifest=JSON.parse(read('manifest.json')),baseline=JSON.parse(read('vendor/manifest.base.json'));
  assert.equal(manifest.version,project.version);assert.equal(manifest.homepage_url,project.repository);
  for(const key of ['permissions','host_permissions','content_scripts','background']) assert.deepEqual(manifest[key],baseline[key]);
  const expectedResources=JSON.parse(JSON.stringify(baseline.web_accessible_resources));
  expectedResources[0].resources.push('libs/pdfjs/*');
  assert.deepEqual(manifest.web_accessible_resources,expectedResources,'Expose only the packaged PDF parser resources');
  assert.equal(JSON.parse(read('_locales/zh_CN/messages.json')).extName.message,project.name);
  assert(!/Ocyss|ocyss|68412205|net-conf\.json|reward\.png|关于&赞赏|feishu\.cn/.test(source));
  for(const name of ['_boss-helper-message_','__boss-helper-content__','appearance-conf','local:FormDataPreses']) assert(source.includes(name),'Preserve compatibility key '+name);
  const staging=fs.mkdtempSync(path.join(os.tmpdir(),'boss-helper-personal-check-'));
  const result=build(staging);
  for(const file of result.files) assert.equal(sha256(fs.readFileSync(path.join(staging,file))),sha256(fs.readFileSync(path.join(root,file))),'Generated file differs: '+file);
  const checksums=JSON.parse(read('checksums.json'));
  for(const [file,expected] of Object.entries(checksums)) assert.equal(sha256(fs.readFileSync(path.join(root,file))),expected);
  for(const size of [16,32,48,64,128,256]) {
    const png=fs.readFileSync(path.join(root,'icons',size+'.png'));
    assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
    for(let at=8;at<png.length;) {
      const length=png.readUInt32BE(at);
      assert.equal(crc32(png.subarray(at+4,at+8+length)),png.readUInt32BE(at+8+length));
      at+=length+12;
    }
  }
  const resolved=fs.realpathSync(staging),temp=fs.realpathSync(os.tmpdir());
  assert(path.dirname(resolved)===temp&&path.basename(resolved).startsWith('boss-helper-personal-check-'));
  fs.rmSync(resolved,{recursive:true});
}

async function main() {
  generatedChecks();
  await runtimeChecks();
  await uiChecks();
  console.log('PASS: personal metadata/UI, local-only project config, no remote announcements or polling, preserved storage/permissions, deterministic rebuild, checksums and icons.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
