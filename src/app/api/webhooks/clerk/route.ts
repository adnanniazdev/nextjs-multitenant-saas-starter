import type { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { withAdmin } from "@/server/db/rls";
import { users } from "@/server/db/schema";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is missing from env variables.");
    return new Response("Error: Please set CLERK_WEBHOOK_SECRET", {
      status: 500,
    });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying Clerk webhook:", err);
    return new Response("Error: Verification failed", { status: 400 });
  }

  const eventType = evt.type;

  // We only handle user profile sync events
  if (
    eventType !== "user.created" &&
    eventType !== "user.updated" &&
    eventType !== "user.deleted"
  ) {
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const eventData = evt.data as {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };

  const id = eventData.id;

  // Run in withAdmin since Clerk syncing is global user profile management (bypasses RLS)
  await withAdmin(async (adminDb) => {
    if (eventType === "user.created") {
      const email = eventData.email_addresses?.[0]?.email_address;
      if (!email) {
        throw new Error("Missing email address in user.created event");
      }
      const firstName = eventData.first_name || "";
      const lastName = eventData.last_name || "";
      const name = `${firstName} ${lastName}`.trim() || email.split("@")[0];
      const avatarUrl = eventData.image_url || "";

      await adminDb.insert(users).values({
        clerkId: id,
        email,
        name,
        avatarUrl,
      });
    }

    if (eventType === "user.updated") {
      const email = eventData.email_addresses?.[0]?.email_address;
      if (!email) {
        throw new Error("Missing email address in user.updated event");
      }
      const firstName = eventData.first_name || "";
      const lastName = eventData.last_name || "";
      const name = `${firstName} ${lastName}`.trim() || email.split("@")[0];
      const avatarUrl = eventData.image_url || "";

      await adminDb
        .update(users)
        .set({
          email,
          name,
          avatarUrl,
        })
        .where(eq(users.clerkId, id));
    }

    if (eventType === "user.deleted") {
      await adminDb.delete(users).where(eq(users.clerkId, id));
    }
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
