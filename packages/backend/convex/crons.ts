import { cronJobs, makeFunctionReference } from "convex/server";
const crons = cronJobs();
crons.interval("Clean devotional images and recover interrupted status", { minutes: 30 }, makeFunctionReference<"mutation">("devotionalImages:cleanup"), {});
crons.daily("Refresh daily image availability", { hourUTC: 3, minuteUTC: 0 }, makeFunctionReference<"mutation">("devotionalImages:changeDay"), {});
crons.daily("Remove orphaned devotional image uploads", { hourUTC: 4, minuteUTC: 0 }, makeFunctionReference<"mutation">("devotionalImages:cleanupOrphans"), { cursor: null });
export default crons;
