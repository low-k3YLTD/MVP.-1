import Stripe from "stripe";
import { Request, Response } from "express";
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "../services/subscriptionService";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * Handle Stripe webhook events
 * This endpoint receives events from Stripe and processes subscription changes
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig || !webhookSecret) {
    console.error("[Webhook] Missing signature or webhook secret");
    return res.status(400).send("Missing signature or webhook secret");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Subscription created: ${subscription.id}`);
        
        const priceId = (subscription.items.data[0]?.price?.id) as string;
        await handleSubscriptionCreated(
          subscription.id,
          subscription.customer as string,
          priceId
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Subscription updated: ${subscription.id}`);
        await handleSubscriptionUpdated(subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Subscription deleted: ${subscription.id}`);
        await handleSubscriptionDeleted(subscription.id);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Payment succeeded: ${invoice.id}`);
        // Handle successful payment - could update payment history
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Webhook] Payment failed: ${invoice.id}`);
        // Handle failed payment - could notify user
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("[Webhook] Error processing event:", error);
    res.status(500).send(`Webhook processing error: ${error.message}`);
  }
}

/**
 * Middleware to parse raw body for Stripe webhook
 * Express body parser needs to be raw for webhook signature verification
 */
export function stripeWebhookMiddleware(req: Request, res: Response, next: Function) {
  if (req.path === "/api/webhooks/stripe") {
    // Use raw body for Stripe webhook
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk.toString("utf8");
    });
    req.on("end", () => {
      req.body = rawBody;
      handleStripeWebhook(req, res);
    });
  } else {
    next();
  }
}
