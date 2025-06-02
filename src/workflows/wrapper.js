// This is a wrapper file for exporting both the Astro application as well as
// the VideoDiscoveryWorkflow and SubtitleProcessingWorkflow classes. 
// This is necessary because Astro does not allow us to manually export 
// non-Astro stuff as part of the bundle file.
import astroEntry, { pageMap } from "./_worker.js/index.js";
import { VideoDiscoveryWorkflow } from "../src/workflows/video_discovery_workflow.js";
import { SubtitleProcessingWorkflow } from "../src/workflows/subtitle_processing_workflow.js";

export default astroEntry;
export { VideoDiscoveryWorkflow, SubtitleProcessingWorkflow, pageMap };