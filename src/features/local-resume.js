/* Optional installation-local data; never included in the public package. */
async function BHLoadLocalResume() {
  try {
    const response = await fetch(O.runtime.getURL('private/resume-context.json'), {cache: 'no-store'});
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 200000) return null;
    const value = JSON.parse(text);
    if (value?.kind !== 'boss-helper-resume-plan' || value.version !== 1 ||
        typeof value.resumeText !== 'string' || value.resumeText.length < 40 || value.resumeText.length > 50000) return null;
    return {kind: value.kind, version: 1, resumeText: value.resumeText};
  } catch { return null; }
}
/* end local resume loader */
