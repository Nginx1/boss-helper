/* Local-only file extraction in the isolated extension content world. */
var BHRFileLimit = 8 * 1024 * 1024;
var BHRPDFModule;

async function BHRLoadPDF() {
  if (!BHRPDFModule) BHRPDFModule = (async () => {
    const base = n.runtime.getURL('libs/pdfjs/');
    // Use PDF.js's supported in-process worker handler. No remote worker or CDN.
    globalThis.pdfjsWorker = await import(base + 'legacy/build/pdf.worker.min.mjs');
    const library = await import(base + 'legacy/build/pdf.min.mjs');
    return {library, base};
  })().catch(error => { BHRPDFModule = undefined; throw error; });
  return BHRPDFModule;
}

function BHRDecodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, value) => {
    if (value[0] !== '#') return {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"}[value.toLowerCase()];
    const code = value[1].toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : Number(value.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '�';
  });
}

function BHRDocxText(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<(?:\w+:)?document\b/.test(xml) ||
      !/<\/(?:\w+:)?document\s*>/.test(xml)) throw Error('Word 正文无效，请另存为 DOCX 后重试。');
  const parts = [];
  let inText = false;
  for (const token of xml.matchAll(/<[^>]*>|[^<]+/g)) {
    const value = token[0];
    if (value.startsWith('<')) {
      if (/^<(?:\w+:)?t(?:\s|>)/.test(value)) inText = !/\/\s*>$/.test(value);
      else if (/^<\/(?:\w+:)?t\s*>/.test(value)) inText = false;
      else if (/^<\/(?:\w+:)?p\s*>/.test(value) || /^<(?:\w+:)?br\b/.test(value)) parts.push('\n');
      else if (/^<(?:\w+:)?tab\b/.test(value)) parts.push('\t');
    } else if (inText) parts.push(BHRDecodeEntities(value));
  }
  return parts.join('');
}

function BHRZipCRC(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

async function BHRUnzipDocument(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--)
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  if (eocd < 0) throw Error('不是有效的 DOCX 文件，请勿只修改文件后缀。');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  if (count > 5000 || at === 0xffffffff) throw Error('Word 文件结构过大，请另存简历正文后重试。');
  for (let index = 0; index < count; index++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw Error('DOCX 压缩目录损坏。');
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true);
    const expectedCRC = view.getUint32(at + 16, true), packed = view.getUint32(at + 20, true), size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    if (at + 46 + nameLength + extra + comment > bytes.length) throw Error('DOCX 目录越界。');
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    if (name !== 'word/document.xml') continue;
    if (flags & 1) throw Error('请先移除 Word 文档密码。');
    if (size > 4 * 1024 * 1024 || packed > BHRFileLimit || local + 30 > bytes.length ||
        view.getUint32(local, true) !== 0x04034b50) throw Error('Word 正文过大或结构损坏。');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + packed > bytes.length) throw Error('Word 正文数据不完整。');
    const input = bytes.subarray(start, start + packed);
    if (method === 0) {
      if (input.length !== size || BHRZipCRC(input) !== expectedCRC) throw Error('Word 正文校验失败。');
      return new TextDecoder('utf-8', {fatal: true}).decode(input);
    }
    if (method !== 8) throw Error('此 Word 压缩格式暂不支持，请另存为标准 DOCX。');
    const reader = new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const {value, done} = await reader.read(); if (done) break;
        length += value.length;
        if (length > 4 * 1024 * 1024) throw Error('Word 解压正文超过大小限制。');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const result = new Uint8Array(length);
    let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    if (length !== size || BHRZipCRC(result) !== expectedCRC) throw Error('Word 正文校验失败。');
    return new TextDecoder('utf-8', {fatal: true}).decode(result);
  }
  throw Error('DOCX 中未找到简历正文。');
}

async function BHRReadResume(payload, {loadPDF = BHRLoadPDF} = {}) {
  const name = String(payload?.name || '').toLowerCase();
  const encoded = payload?.data;
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(BHRFileLimit / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('文件数据无效或超过 8 MB。');
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  if (!bytes.length || bytes.length > BHRFileLimit) throw Error('请选择非空且小于 8 MB 的简历文件。');
  let text = '', format = '', pages = 0;
  const warnings = [];
  if (name.endsWith('.pdf')) {
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw Error('PDF 文件头无效。');
    format = 'PDF';
    const {library, base} = await loadPDF();
    const task = library.getDocument({data: bytes, isEvalSupported: false, useWasm: false,
      useWorkerFetch: false, disableFontFace: true, verbosity: 0,
      cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/',
      isOffscreenCanvasSupported: false, isImageDecoderSupported: false, enableXfa: false});
    try {
      const pdf = await task.promise; pages = pdf.numPages;
      if (pages > 20) throw Error('PDF 超过 20 页，请保留简历正文后重试。');
      for (let number = 1; number <= pages; number++) {
        const page = await pdf.getPage(number), content = await page.getTextContent();
        const value = content.items.filter(item => typeof item.str === 'string')
          .map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
        if (!value.trim()) warnings.push('第 ' + number + ' 页没有可提取文字，请检查是否为扫描图片。');
        text += value + '\n'; page.cleanup();
        if (text.length > 60000) throw Error('PDF 文字过多，请保留简历正文后重试。');
      }
    } catch (error) {
      if (error?.name === 'PasswordException') throw Error('请先移除 PDF 密码后导入。');
      throw error;
    } finally { await task.destroy(); }
  } else if (name.endsWith('.docx')) {
    format = 'DOCX'; text = BHRDocxText(await BHRUnzipDocument(bytes));
  } else if (/\.(txt|md)$/.test(name)) {
    format = '文本';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes);
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes);
    else try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch { text = new TextDecoder('gb18030').decode(bytes); warnings.push('已按 GB18030 解码，请核对中文是否正确。'); }
  } else throw Error('支持 PDF、Word（DOCX）、TXT、Markdown；旧 DOC 请先另存为 DOCX。');
  text = text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (text.length < 40) throw Error('没有提取到足够正文。扫描 PDF 请先进行文字识别，再粘贴文字或导入可复制文字的 PDF。');
  if (text.length > 50000) throw Error('正文超过 5 万字，请保留与求职有关的内容后重试。');
  return {text, format, pages, warnings};
}
