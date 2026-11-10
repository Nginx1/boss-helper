async function BHLoadLocalSalaryChoice() {
  try {
    const response = await fetch(O.runtime.getURL('private/monthly-salary-choice.json'), {cache: 'no-store'});
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 1000) return null;
    const choice = JSON.parse(text), range = choice?.from;
    if (choice?.version !== 1 || !Array.isArray(range) || range.length !== 3 ||
        !range.slice(0, 2).every(value => Number.isFinite(value) && value >= 0) || range[2] !== false) return null;
    return {version: 1, from: range};
  } catch { return null; }
}
