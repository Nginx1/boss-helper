const zlib = require('node:zlib');

const glyphs = {
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
};
const cells = Object.entries(glyphs).flatMap(([letter, rows]) => rows.flatMap((row, y) =>
  [...row].flatMap((bit, x) => bit === '1' ? [[(letter === 'B' ? 10 : 36) + x * 4, 15 + y * 4]] : [])));
const logoSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="14" fill="#0f172a"/>' +
  cells.map(([x,y]) => `<rect x="${x}" y="${y}" width="4" height="4" fill="#f0fdfa"/>`).join('') +
  '<circle cx="51" cy="52" r="8" fill="#2dd4bf"/>' +
  '<path d="m47 52 3 3 5-6" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const maskSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="4" width="44" height="56" rx="8" fill="#334155"/><rect x="17" y="11" width="30" height="12" rx="2" fill="#a7f3d0"/><path d="M19 32h4m7 0h4m7 0h4M19 42h4m7 0h4m7 0h4M19 52h4m7 0h4m7 0h4" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/></svg>';
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let n=0;n<8;n++) crc = (crc>>>1) ^ ((crc&1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type), head = Buffer.alloc(4), tail = Buffer.alloc(4);
  head.writeUInt32BE(bytes.length); tail.writeUInt32BE(crc32(Buffer.concat([name,bytes])));
  return Buffer.concat([head,name,bytes,tail]);
}
function lineDistance(x,y,x1,y1,x2,y2) {
  const t = Math.max(0,Math.min(1,((x-x1)*(x2-x1)+(y-y1)*(y2-y1))/((x2-x1)**2+(y2-y1)**2)));
  return Math.hypot(x-x1-t*(x2-x1),y-y1-t*(y2-y1));
}
function colorAt(x,y) {
  const cx = Math.max(14,Math.min(50,x)), cy = Math.max(14,Math.min(50,y));
  if (Math.hypot(x-cx,y-cy)>14) return [0,0,0,0];
  if (lineDistance(x,y,47,52,50,55)<1.25 || lineDistance(x,y,50,55,55,49)<1.25) return [15,23,42,255];
  if (Math.hypot(x-51,y-52)<=8) return [45,212,191,255];
  if (cells.some(([a,b])=>x>=a&&x<a+4&&y>=b&&y<b+4)) return [240,253,250,255];
  return [15,23,42,255];
}
function iconPNG(size) {
  const bytes = Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const colors = [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([dx,dy])=>colorAt((x+dx)*64/size,(y+dy)*64/size));
    const at = y*(size*4+1)+1+x*4;
    for(let c=0;c<4;c++) bytes[at+c]=Math.round(colors.reduce((sum,color)=>sum+color[c],0)/4);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(bytes,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const dataURI = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
module.exports = {logoSVG, maskSVG, dataURI, iconPNG, crc32};
