/* Personal edition project metadata is embedded at build time. */
var BHProject = Object.freeze(/*@@PROJECT_METADATA@@*/);

function BHPersonalNetConf() {
  return {
    version: BHProject.version,
    version_description: BHProject.releaseNotes,
    notification: [],
    feedback: BHProject.feedback,
    store: {},
  };
}

async function vF() {
  return BHPersonalNetConf();
}
