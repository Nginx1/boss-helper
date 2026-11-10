const BHDeliveryHistoryPanel = I({
  __name: 'DeliveryHistory',
  setup() {
    const helper = SF(), rows = N([]), busy = N(false), notice = N('');
    async function load(format) {
      if (busy.value) return;
      busy.value = true;
      notice.value = '';
      try {
        const records = await BHListDeliveryHistory(helper, !format);
        rows.value = records.slice(0, 20);
        if (!format || !records.length) return;
        const now = new Date();
        const data = format === 'csv' ? BHDeliveryCSV(records) : JSON.stringify({schemaVersion: 1,
          exportedAt: now.toISOString(), records}, null, 2);
        const url = URL.createObjectURL(new Blob([data], {type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'}));
        try {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `boss-helper-投递记录-${now.toISOString().slice(0, 10)}.${format}`;
          anchor.click();
        } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
        notice.value = `已导出 ${records.length} 条记录。`;
      } catch (error) { notice.value = error.message || '投递记录读取失败'; }
      finally { busy.value = false; }
    }
    Ai(() => load());
    const button = (text, onClick) => H(AX, {size: 'xs', disabled: busy.value, onClick}, {default: () => text});
    return () => V('section', {style: {padding: '10px 0', borderBottom: '1px solid #ddd'}}, [
      V('strong', null, '投递记录'),
      V('p', null, '从本版本开始自动保存在本机。CSV 可筛选结果，JSON 可用于分析岗位描述和评分理由。'),
      V('div', {style: {display: 'flex', gap: '8px', flexWrap: 'wrap'}}, [
        button('刷新记录', () => load()), button('导出 CSV', () => load('csv')), button('导出 JSON', () => load('json'))]),
      V('p', {role: 'status'}, notice.value || (busy.value ? '正在读取记录…' : rows.value.length ? '最近处理记录' : '暂无记录')),
      ...rows.value.map(row => V('details', {key: row.id}, [
        V('summary', null, `${new Date(row.at).toLocaleString()} · ${BHDeliveryLabels[row.outcome]} · ${row.title} · ${row.company}`),
        V('div', {style: {whiteSpace: 'pre-wrap'}}, [row.reason,
          row.screening ? `\nAI ${row.screening.score} 分 / 及格线 ${row.screening.threshold} · ${row.screening.decision}${row.screening.fit ? ' · ' + row.screening.fit : ''}` : '',
          row.outcome === 'delivered' && row.screening ? `\n${row.screening.summary}` : '',
          row.delivery === 'confirmed' ? row.finishedAt ? `\n招呼已提交 ${row.greetingSubmitted} 条` : '\n招呼进度待确认' : ''].join('')),
      ])),
    ]);
  },
});
