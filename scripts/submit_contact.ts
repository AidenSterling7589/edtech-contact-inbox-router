import { randomUUID } from "node:crypto";
import { routeContactSubmission } from "../src/contact_workflow.js";

const captchaToken = process.env.DEMO_CAPTCHA_TOKEN;
if (!captchaToken) throw new Error("DEMO_CAPTCHA_TOKEN is required");
const captchaWidgetRecordId = process.env.DEMO_CAPTCHA_WIDGET_RECORD_ID;
if (!captchaWidgetRecordId) throw new Error("DEMO_CAPTCHA_WIDGET_RECORD_ID is required");

const result = await routeContactSubmission({
  submissionId: randomUUID(),
  name: "Maya Chen",
  email: "maya@example.edu",
  institution: "Northbridge Learning",
  courseDelivery: "blended",
  learnerDeadline: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  educatorReporting: "completion",
  message: "We need completion reporting for our autumn learner cohort.",
  captchaWidgetRecordId,
  captchaToken,
});

console.log("Contact routed:", result);
