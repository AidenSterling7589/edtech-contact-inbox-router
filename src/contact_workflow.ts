import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const contactSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  institution: z.string().trim().min(2).max(120),
  courseDelivery: z.enum(["live", "self-paced", "blended"]),
  learnerDeadline: z.string().datetime({ offset: true }),
  educatorReporting: z.enum(["completion", "scores", "attendance", "custom"]),
  message: z.string().trim().min(10).max(2_000),
  captchaWidgetRecordId: z.string().min(1),
  captchaToken: z.string().min(1),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;
export type InboxPriority = "overdue" | "urgent" | "routine";

export function classifyDeadline(deadline: string, now: Date): InboxPriority {
  const hours = (new Date(deadline).getTime() - now.getTime()) / 3_600_000;
  if (hours < 0) return "overdue";
  if (hours <= 72) return "urgent";
  return "routine";
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

export function buildInboxMessage(submission: ContactSubmission, now: Date) {
  const priority = classifyDeadline(submission.learnerDeadline, now);
  return {
    subject: `[${priority.toUpperCase()}] ${submission.institution}: ${submission.courseDelivery} course enquiry`,
    html: `<h1>${escapeHtml(submission.institution)} enquiry</h1>
<dl>
  <dt>Contact</dt><dd>${escapeHtml(submission.name)} &lt;${escapeHtml(submission.email)}&gt;</dd>
  <dt>Course delivery</dt><dd>${submission.courseDelivery}</dd>
  <dt>Learner deadline</dt><dd>${escapeHtml(submission.learnerDeadline)}</dd>
  <dt>Educator reporting</dt><dd>${submission.educatorReporting}</dd>
  <dt>Priority</dt><dd>${priority}</dd>
</dl>
<p>${escapeHtml(submission.message)}</p>`,
    priority,
  };
}

export async function routeContactSubmission(input: unknown, now = new Date()) {
  const submission = contactSubmissionSchema.parse(input);
  await infrai.captcha.verify({
    widget_record_id: submission.captchaWidgetRecordId,
    token: submission.captchaToken,
    action: "edtech_contact",
    score_threshold: 0.6,
  });

  const inbox = process.env.TEAM_INBOX;
  if (!inbox) throw new Error("TEAM_INBOX is required");
  const message = buildInboxMessage(submission, now);
  const delivery = await infrai.email.send(
    { to: inbox, subject: message.subject, html: message.html },
    submission.submissionId,
  );
  return { accepted: true as const, priority: message.priority, messageId: delivery.message_id };
}
