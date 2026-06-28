import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { withAdmin, withTenant } from "@/server/db/rls";
import { processedWebhookEvents, workspaces } from "@/server/db/schema";
import { stripe } from "@/server/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is missing.");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  // 1. Idempotency Check: Verify if event has already been processed
  const alreadyProcessed = await withAdmin(async (adminDb) => {
    return await adminDb.query.processedWebhookEvents.findFirst({
      where: eq(processedWebhookEvents.id, event.id),
    });
  });

  if (alreadyProcessed) {
    return NextResponse.json(
      { received: true, ignored: true },
      { status: 200 },
    );
  }

  // Helper to retrieve workspace by Stripe Customer ID
  const getWorkspaceByCustomerId = async (customerId: string) => {
    return await withAdmin(async (adminDb) => {
      return await adminDb.query.workspaces.findFirst({
        where: eq(workspaces.stripeCustomerId, customerId),
      });
    });
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!workspaceId) {
          throw new Error("No workspaceId found in session metadata");
        }

        // Fetch subscription to get period dates
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        // Update workspace inside the specific tenant's RLS scope
        await withTenant(workspaceId, async (tenantDb) => {
          await tenantDb
            .update(workspaces)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan: "pro",
              subscriptionStatus: subscription.status,
              currentPeriodEnd: subscription.items.data[0]
                ? new Date(subscription.items.data[0].current_period_end * 1000)
                : null,
            })
            .where(eq(workspaces.id, workspaceId));
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Resolve workspace using admin context
        const workspace = await getWorkspaceByCustomerId(customerId);
        if (!workspace) {
          throw new Error(`Workspace not found for Customer ID: ${customerId}`);
        }

        // Update plan details inside tenant's RLS scope
        await withTenant(workspace.id, async (tenantDb) => {
          await tenantDb
            .update(workspaces)
            .set({
              subscriptionStatus: subscription.status,
              currentPeriodEnd: subscription.items.data[0]
                ? new Date(subscription.items.data[0].current_period_end * 1000)
                : null,
              plan:
                subscription.status === "active" ||
                subscription.status === "trialing"
                  ? "pro"
                  : "free",
            })
            .where(eq(workspaces.id, workspace.id));
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const workspace = await getWorkspaceByCustomerId(customerId);
        if (!workspace) {
          throw new Error(`Workspace not found for Customer ID: ${customerId}`);
        }

        // Downgrade workspace inside tenant's RLS scope
        await withTenant(workspace.id, async (tenantDb) => {
          await tenantDb
            .update(workspaces)
            .set({
              plan: "free",
              stripeSubscriptionId: null,
              subscriptionStatus: "cancelled",
              currentPeriodEnd: null,
            })
            .where(eq(workspaces.id, workspace.id));
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const workspace = await getWorkspaceByCustomerId(customerId);
        if (!workspace) {
          throw new Error(`Workspace not found for Customer ID: ${customerId}`);
        }

        // Update status inside tenant's RLS scope
        await withTenant(workspace.id, async (tenantDb) => {
          await tenantDb
            .update(workspaces)
            .set({
              subscriptionStatus: "past_due",
            })
            .where(eq(workspaces.id, workspace.id));
        });
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // 2. Mark event as processed (Idempotency logging)
    await withAdmin(async (adminDb) => {
      await adminDb.insert(processedWebhookEvents).values({
        id: event.id,
      });
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Stripe Webhook processing error: ${message}`);
    return new Response(`Webhook handler failed: ${message}`, {
      status: 500,
    });
  }
}
