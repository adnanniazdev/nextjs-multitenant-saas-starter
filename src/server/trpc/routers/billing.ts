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

      const getReturnUrl = () => {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        if (baseUrl.includes("lvh.me")) {
          return baseUrl.replace("://", `://${ctx.workspace.slug}.`);
        }
        if (baseUrl.includes("localhost")) {
          const port = baseUrl.split(":")[2] || "3000";
          return `http://${ctx.workspace.slug}.lvh.me:${port}`;
        }
        return baseUrl.replace("://", `://${ctx.workspace.slug}.`);
      };

      const returnUrl = `${getReturnUrl()}/billing`;

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

  // Mutation: Create Stripe Subscription Intent (Owner-only)
  createSubscriptionIntent: workspaceProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only workspace owners can manage subscriptions.",
        });
      }

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

        // 2. Create Subscription with default_incomplete payment behavior
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: input.priceId }],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            workspaceId: ctx.workspace.id,
          },
        });

        // 3. Extract client secret
        // biome-ignore lint/suspicious/noExplicitAny: Stripe invoice is cast to access expanded payment intent fields
        const invoice = subscription.latest_invoice as any;
        // biome-ignore lint/suspicious/noExplicitAny: Stripe payment intent is cast to access client_secret field
        const paymentIntent = invoice?.payment_intent as any;

        if (!paymentIntent || !paymentIntent.client_secret) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate payment intent client secret.",
          });
        }

        return {
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret,
        };
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

    const getReturnUrl = () => {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      if (baseUrl.includes("lvh.me")) {
        return baseUrl.replace("://", `://${ctx.workspace.slug}.`);
      }
      if (baseUrl.includes("localhost")) {
        const port = baseUrl.split(":")[2] || "3000";
        return `http://${ctx.workspace.slug}.lvh.me:${port}`;
      }
      return baseUrl.replace("://", `://${ctx.workspace.slug}.`);
    };

    const returnUrl = `${getReturnUrl()}/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: portalSession.url };
  }),
});
