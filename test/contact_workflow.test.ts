import { describe, expect, it } from "vitest";
import { buildInboxMessage, contactSubmissionSchema } from "../src/contact_workflow.js";

describe("contact inbox routing", () => {
  it("marks a learner deadline inside 72 hours as urgent and exposes the reporting need", () => {
    const submission = contactSubmissionSchema.parse({
      submissionId: "5dd57a46-abcf-4cb0-b8ba-f790e5dc3f11",
      name: "Maya Chen",
      email: "maya@example.edu",
      institution: "Northbridge Learning",
      courseDelivery: "blended",
      learnerDeadline: "2026-09-28T12:00:00.000Z",
      educatorReporting: "completion",
      message: "We need completion reporting for our autumn learner cohort.",
      captchaWidgetRecordId: "widget-record-id",
      captchaToken: "test-token",
    });

    const message = buildInboxMessage(submission, new Date("2026-09-26T12:00:00.000Z"));

    expect(message.priority).toBe("urgent");
    expect(message.subject).toContain("[URGENT]");
    expect(message.html).toContain("<dt>Educator reporting</dt><dd>completion</dd>");
  });
});
