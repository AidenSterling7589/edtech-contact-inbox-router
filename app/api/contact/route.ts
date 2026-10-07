import { ZodError } from "zod";
import { routeContactSubmission } from "../../../src/contact_workflow.js";
import { InfraiError } from "../../../src/infrai_client.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await routeContactSubmission(await request.json());
    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid contact submission", issues: error.flatten() }, { status: 400 });
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      return Response.json({ error: "Submission verification was rejected" }, { status: error.status });
    }
    console.error("Contact submission failed", error);
    return Response.json({ error: "Unable to route contact submission" }, { status: 500 });
  }
}
