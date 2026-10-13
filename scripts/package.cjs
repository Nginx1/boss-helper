const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const assert=require('node:assert/strict');
const {build,root,read}=require('./build.cjs');
const {crc32}=require('./icons.cjs');

function zip(files,date) {
  const local=[],central=[];
  let offset=0;
  const dosDate=((date.getUTCFullYear()-1980)<<9)|((date.getUTCMonth()+1)<<5)|date.getUTCDate();
  for(const [file,raw] of files) {
    assert(!file.includes('..')&&!file.startsWith('/')&&!file.includes('\\'));
    const name=Buffer.from(file),data=zlib.deflateRawSync(raw,{level:9}),crc=crc32(raw);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);
    header.writeUInt16LE(dosDate,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26);
    local.push(header,name,data);
    const record=Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);
    record.writeUInt16LE(dosDate,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(data.length,20);record.writeUInt32LE(raw.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);
    central.push(record,name);offset+=header.length+name.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
if(require.main===module) {
  const args=process.argv.slice(2);
  assert(args.length===0||(args.length===2&&args[0]==='--out'),'Usage: node scripts/package.cjs [--out ZIP_FILE]');
  const project=JSON.parse(read('src/project.json'));
  const staging=build(path.join(root,'dist','edge'));
  const files=staging.files.map(file=>[file,fs.readFileSync(path.join(staging.root,file))]);
  const destination=path.resolve(args[0]?args[1]:path.join(root,'dist','boss-helper-personal-'+project.version+'.zip'));
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,zip(files,new Date(project.releaseDate+'T00:00:00Z')));
  console.log('Packaged '+files.length+' installation files: '+destination);
}
module.exports={zip};
