import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { workspaces } from "../../db/schema";
import { stripe } from "../../stripe";
import { router, workspaceProcedure } from "../trpc";

export const billingRouter = router({
  // Query: Get workspace billing details (Owner-only)
  getStatus: workspaceProcedure.query(async ({ ctx }) => {
    if (ctx.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only workspace owners can view billing details.",
      });
    }

    return await ctx.withTenantScope(async (tenantDb) => {
      const workspace = await tenantDb.query.workspaces.findFirst({
        where: eq(workspaces.id, ctx.workspace.id),
      });

      return {
        plan: workspace?.plan,
        subscriptionStatus: workspace?.subscriptionStatus,
        currentPeriodEnd: workspace?.currentPeriodEnd,
        hasActiveSubscription:
          workspace?.plan === "pro" &&
          (workspace?.subscriptionStatus === "active" ||
            workspace?.subscriptionStatus === "trialing"),
      };
    });
  }),

  // Mutation: Create Stripe Checkout Session (Owner-only)
  createCheckout: workspaceProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace owners can manage subscriptions.",
        });
      }

      const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings/billing`;

      return await ctx.withTenantScope(async (tenantDb) => {
        let customerId = ctx.workspace.stripeCustomerId;

        // 1. Create Stripe Customer if not existing
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: ctx.user.email,
            name: ctx.workspace.name,
            metadata: {
              workspaceId: ctx.workspace.id,
            },
          });
          customerId = customer.id;

          // Save customer ID
          await tenantDb
            .update(workspaces)
            .set({ stripeCustomerId: customerId })
            .where(eq(workspaces.id, ctx.workspace.id));
        }

        // 2. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: input.priceId,
              quantity: 1,
            },
          ],
          success_url: `${returnUrl}?success=true`,
          cancel_url: `${returnUrl}?cancelled=true`,
          metadata: {
            workspaceId: ctx.workspace.id,
          },
        });

        if (!session.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate checkout session url.",
          });
        }

        return { url: session.url };
      });
    }),

  // Mutation: Create Stripe Customer Portal (Owner-only)
  createPortal: workspaceProcedure.mutation(async ({ ctx }) => {
    if (ctx.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only workspace owners can manage subscriptions.",
      });
    }

    const customerId = ctx.workspace.stripeCustomerId;

    if (!customerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active Stripe customer found. Please subscribe first.",
      });
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: portalSession.url };
  }),
});
