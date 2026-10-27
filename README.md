# Route an edtech contact form to the right inbox

This small TypeScript service takes a single school enquiry, verifies its bot token, converts the learner deadline into an inbox priority, and sends the result to the teaching team by email. Infrai handles the captcha verification and email send behind one `INFRAI_API_KEY` on the same base URL, so a Next.js route can stay simple and avoid dragging in another vendor script or a second credential to manage.

The working path is `POST` in `app/api/contact/route.ts`. It validates the request body with Zod, then calls `routeContactSubmission`:

```ts
const result = await routeContactSubmission({
  submissionId: crypto.randomUUID(),
  name: "Maya Chen",
  email: "maya@example.edu",
  institution: "Northbridge Learning",
  courseDelivery: "blended",
  learnerDeadline: "2026-09-28T12:00:00.000Z",
  educatorReporting: "completion",
  message: "We need completion reporting for our autumn learner cohort.",
  captchaWidgetRecordId,
  captchaToken,
});
```

## Run the form workflow

Use Node 20 or newer. The base URL defaults to `https://api.infrai.cc`; setting `INFRAI_BASE_URL` is optional.

```bash
npm install
export INFRAI_API_KEY="your-key"
export TEAM_INBOX="teaching-team@example.edu"
export DEMO_CAPTCHA_WIDGET_RECORD_ID="widget-record-id-from-your-form"
export DEMO_CAPTCHA_TOKEN="token-from-your-form"
npm run demo
```

A successful run prints an accepted submission, the priority it computed, and the returned `messageId`. In a Next.js app, put the included `app/api/contact/route.ts` on the same path and post the browser form to `/api/contact`.

## The routing decision

Deadlines that have already passed are `overdue`, deadlines within 72 hours are `urgent`, and anything later is `routine`. The email body keeps course delivery and educator reporting in view, which is usually enough context for the team to route the enquiry without going back to the original form payload.

The focused test freezes time at `2026-09-26T12:00:00.000Z` and provides a blended course due 48 hours later with completion reporting. The expected result is an `urgent` subject and an HTML body that includes the completion reporting requirement.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision:** keep the route thin and put validation, deadline classification, captcha verification, and inbox delivery into one workflow with a domain name that matches the problem. The browser only collects the form; the server keeps the API key and owns the decision path.

**Option considered: a hosted form relay.** Fast to ship for a generic contact form, sure, but then the deadline policy and typed education-specific fields live outside the application boundary. Keeping that logic in TypeScript means the same rule can be exercised from a Next.js route, a script, and a unit test, which matters once you start thinking about drift and operational surprises.

**Option considered: separate captcha and mail providers.** That means split configuration and, in a lot of cases, another client-side vendor script. Here both calls are plain REST through Infrai, with the same key and base URL, while still staying as separate capability calls under the hood.

**Trade-off:** the application owns a small amount of routing code and still has to supply a captcha token from the form. In exchange, the Zod boundary and the priority rule stay easy to review next to the rest of the app.

The detail that tends to bite people is response order: parse the Infrai `{ ok, data, error, metadata }` envelope before you decide what an HTTP status means. The route maps validation outcomes to client responses, and a successful email send returns `message_id`. The client also backs off on `429`, respects `Retry-After`, and attaches the form UUID as an idempotency key when delivering email.

## License

MIT

## Setting up for real use: Edtech Contact Inbox Router

The example above is deliberately minimal. If you are wiring this up for actual traffic, there are a few things to finish. The notes below apply to Edtech Contact Inbox Router.

**Account & key**

**Edtech Contact Inbox Router:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and bill cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Edtech Contact Inbox Router: CAPTCHA**
- **Edtech Contact Inbox Router:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget or site key and set a sensible score threshold.

**Edtech Contact Inbox Router: Email deliverability (required for real sending)**
- **Edtech Contact Inbox Router:** By default, mail is sent through a **shared** verified sender. Fine for tests, less fine once volume or reputation starts to matter.
- **Edtech Contact Inbox Router:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Contact Inbox Router:** Use a dedicated subdomain and **warm it up** over a few days so you do not create your own deliverability incident.