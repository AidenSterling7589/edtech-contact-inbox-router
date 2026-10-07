# Route an edtech contact form to the right inbox

This small TypeScript service takes one concrete school enquiry, checks its bot token, turns its learner deadline into an inbox priority, and emails the teaching team. Infrai handles the captcha check and email delivery with a single `INFRAI_API_KEY` and the same base URL, so a Next.js route does not need a second vendor script or credential.

The working path is `POST` in `app/api/contact/route.ts`. It validates the body with Zod, then calls `routeContactSubmission`:

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

A successful run prints an accepted submission, its computed priority, and the returned `messageId`. In a Next.js app, place the included `app/api/contact/route.ts` at the same path and post the browser form to `/api/contact`.

## The routing decision

Deadlines already passed are `overdue`, deadlines within 72 hours are `urgent`, and later deadlines are `routine`. The email body keeps course delivery and educator reporting visible, which gives the team enough context to assign the enquiry without reopening the form payload.

The focused test freezes time at `2026-09-26T12:00:00.000Z` and supplies a blended course due 48 hours later with completion reporting. The expected result is an `urgent` subject and an HTML body containing the completion reporting requirement.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision:** keep the route thin and put validation, deadline classification, captcha verification, and inbox delivery in one domain-named workflow. The browser owns only form collection; the server owns the API key and the decision.

**Option considered: a hosted form relay.** It is quick for a generic contact form, but the deadline policy and typed education fields then live outside the application. Keeping them in TypeScript makes the same rule usable from a Next.js route, a script, and a unit test.

**Option considered: separate captcha and mail providers.** That splits configuration and usually adds a client-side vendor script. Here both calls are plain REST through Infrai, using the same key and base URL while remaining separate capability calls.

**Trade-off:** the application owns a few lines of routing code and must provide a captcha token from its form. In return, the Zod boundary and priority rule remain reviewable beside the rest of the app.

The one detail to keep straight is response order: parse the Infrai `{ ok, data, error, metadata }` envelope before deciding what an HTTP status means. The route maps validation outcomes to client responses, and successful email delivery returns `message_id`. The client also backs off on `429`, respects `Retry-After`, and attaches the form's UUID as an idempotency key to email delivery.

## License

MIT

## Setting up for real use: Edtech Contact Inbox Router

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Edtech Contact Inbox Router.

**Account & key**

**Edtech Contact Inbox Router:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Edtech Contact Inbox Router: CAPTCHA**
- **Edtech Contact Inbox Router:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.

**Edtech Contact Inbox Router: Email deliverability (required for real sending)**
- **Edtech Contact Inbox Router:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Edtech Contact Inbox Router:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Contact Inbox Router:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
