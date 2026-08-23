import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Parse+validate a JSON body against a Zod schema. Returns the parsed (post-default) type. Throws HttpError on failure. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError("Invalid JSON body.", 400);
  }
  try {
    return schema.parse(json) as z.infer<S>;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new HttpError(e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);
    }
    throw e;
  }
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Wrap a route handler so thrown HttpErrors become clean JSON responses. */
export function route<A extends unknown[]>(
  handler: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      // Let Next.js control-flow signals (dynamic usage, redirect, notFound) propagate.
      const digest = (e as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && (digest.includes("DYNAMIC_SERVER_USAGE") || digest.startsWith("NEXT_"))) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : "Unexpected error.";
      console.error("[api] unhandled:", msg);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}
