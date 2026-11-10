function BHSalarySkipReason(salary, config) {
  if (typeof salary !== 'string') return '';
  const ranges = [['元/时', config.advancedValue.H], ['元/天', config.advancedValue.D],
    ['元/月', config.advancedValue.M], ['K', config.value]];
  for (const [unit, range] of ranges) {
    if (!salary.includes(unit)) continue;
    const monthly = unit === 'K' || unit === '元/月';
    if (monthly && config.onlyMinimum === true) {
      const floor = config.value?.[0];
      if (!Number.isFinite(floor) || floor < 0) return '月薪下限无效，请检查薪资范围';
      const minimum = floor * (unit === 'K' ? 1 : 1000);
      if (!mh(salary, [minimum, Infinity, false])) return `不匹配的薪资范围 ${salary}，预期 ${minimum} ${unit} 起`;
    } else if (!mh(salary, range)) return `不匹配的薪资范围 ${salary}, 预期: ${ph(range, unit)}`;
  }
  return '';
}

async function BHApplyLocalSalaryChoice(conf) {
  const key = 'local:web-geek-job-FormData';
  const current = conf.formData.salaryRange;
  if (conf.formDataKey?.() !== key || !current?.enable || current.onlyMinimum != null) return;
  try {
    const choice = await iu.backgroundTest('boss-helper:local-salary-choice:v1');
    if (choice?.version !== 1 || !Array.isArray(choice.from) || choice.from.length !== 3) return;
    const matches = config => config?.enable && config.onlyMinimum == null &&
      choice.from.every((value, index) => value === config.value?.[index]);
    if (!matches(current)) return;
    const saved = await iu.storageGet(key, null);
    if (conf.formDataKey?.() !== key || conf.formData.salaryRange !== current || !matches(current) || !matches(saved?.salaryRange)) return;
    const result = await iu.storageSet(key, {...saved, salaryRange: {...saved.salaryRange, onlyMinimum: true}});
    if (result === true && conf.formDataKey?.() === key && conf.formData.salaryRange === current && matches(current))
      current.onlyMinimum = true;
  } catch { /* Keep the saved setting when the optional installation file cannot be applied. */ }
}
