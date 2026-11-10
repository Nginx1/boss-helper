let BHDeliveryDatabase;

async function BHDeliveryHistoryStorage(request) {
  const {action, account, rows, after = ''} = request || {};
  if (typeof account !== 'string' || !account || account.length > 200) throw Error('投递记录账号无效');
  BHDeliveryDatabase ??= me('BossHelperDeliveryHistory', 1, {upgrade(db) {db.createObjectStore('records');}})
    .catch(error => {BHDeliveryDatabase = undefined; throw error;});
  const db = await BHDeliveryDatabase;
  if (action === 'write') {
    if (!Array.isArray(rows) || rows.length > 25 || rows.some(row => !row || !/^\d{13}-[\da-f-]{36}$/i.test(row.id) ||
      !Number.isSafeInteger(row.revision) || JSON.stringify(row).length > 26000)) throw Error('投递记录内容无效');
    const tx = db.transaction('records', 'readwrite');
    for (const row of rows) {
      const key = [account, row.id];
      const stored = await tx.store.get(key);
      if (!stored || stored.revision < row.revision) await tx.store.put(row, key);
    }
    await tx.done;
    return {saved: true};
  }
  if (action !== 'list' && action !== 'recent') throw Error('未知投递记录操作');
  const recent = action === 'recent';
  const range = IDBKeyRange.bound([account, recent ? '' : after], [account, '\uffff'], true);
  const tx = db.transaction('records');
  const entries = [];
  const limit = recent ? 20 : 100;
  let cursor = await tx.store.openCursor(range, recent ? 'prev' : 'next');
  while (cursor && entries.length < limit) {
    entries.push(cursor.value);
    cursor = await cursor.continue();
  }
  await tx.done;
  return {rows: entries, next: !recent && cursor ? entries.at(-1).id : ''};
}
/* end delivery history storage */
