import Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  subscriptionPlans,
  userSubscriptions,
  paymentHistory,
  predictionUsageLog,
  users,
} from "../../drizzle/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export interface SubscriptionTierConfig {
  name: string;
  priceInCents: number;
  billingPeriod: "monthly" | "yearly";
  predictionsPerMonth: number;
  hasApiAccess: boolean;
  features: string[];
  displayOrder: number;
}

/**
 * Initialize default subscription plans in Stripe and database
 */
export async function initializeSubscriptionPlans() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const plans: SubscriptionTierConfig[] = [
    {
      name: "Basic",
      priceInCents: 999, // $9.99/month
      billingPeriod: "monthly",
      predictionsPerMonth: 50,
      hasApiAccess: false,
      features: [
        "50 predictions per month",
        "Live race data access",
        "Exotic bet optimizer",
        "Email support",
      ],
      displayOrder: 1,
    },
    {
      name: "Pro",
      priceInCents: 2999, // $29.99/month
      billingPeriod: "monthly",
      predictionsPerMonth: -1, // Unlimited
      hasApiAccess: false,
      features: [
        "Unlimited predictions",
        "Live race data access",
        "Exotic bet optimizer",
        "Advanced analytics",
        "Priority support",
      ],
      displayOrder: 2,
    },
    {
      name: "Premium",
      priceInCents: 4999, // $49.99/month
      billingPeriod: "monthly",
      predictionsPerMonth: -1, // Unlimited
      hasApiAccess: true,
      features: [
        "Unlimited predictions",
        "Live race data access",
        "Exotic bet optimizer",
        "Advanced analytics",
        "API access",
        "Webhook integration",
        "24/7 priority support",
      ],
      displayOrder: 3,
    },
  ];

  for (const plan of plans) {
    try {
      // Check if plan already exists
      const existing = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, plan.name));

      if (existing.length > 0) {
        console.log(`[Subscription] Plan '${plan.name}' already exists, skipping`);
        continue;
      }

      // Create Stripe product
      const product = await stripe.products.create({
        name: `${plan.name} Plan`,
        description: `Equine Oracle Predictor ${plan.name} subscription`,
      });

      // Create Stripe price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.priceInCents,
        currency: "usd",
        recurring: {
          interval: plan.billingPeriod === "monthly" ? "month" : "year",
          interval_count: 1,
        },
      });

      // Store in database
      await db.insert(subscriptionPlans).values({
        name: plan.name,
        stripeProductId: product.id,
        stripePriceId: price.id,
        priceInCents: plan.priceInCents,
        billingPeriod: plan.billingPeriod,
        predictionsPerMonth: plan.predictionsPerMonth,
        hasApiAccess: plan.hasApiAccess ? 1 : 0,
        description: `${plan.name} plan for Equine Oracle Predictor`,
        features: JSON.stringify(plan.features),
        displayOrder: plan.displayOrder,
        isActive: 1,
      });

      console.log(`[Subscription] Created plan '${plan.name}' with Stripe product ${product.id}`);
    } catch (error) {
      console.error(`[Subscription] Failed to create plan '${plan.name}':`, error);
    }
  }
}

/**
 * Get all active subscription plans
 */
export async function getSubscriptionPlans() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, 1));

  return plans.map((plan) => ({
    ...plan,
    features: plan.features ? JSON.parse(plan.features) : [],
  }));
}

/**
 * Create a checkout session for a subscription plan
 */
export async function createCheckoutSession(
  userId: number,
  planId: number,
  successUrl: string,
  cancelUrl: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get user
  const userRecord = await db.select().from(users).where(eq(users.id, userId));
  if (userRecord.length === 0) throw new Error("User not found");

  // Get plan
  const plan = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId));
  if (plan.length === 0) throw new Error("Plan not found");

  const user = userRecord[0];
  const selectedPlan = plan[0];

  // Create or get Stripe customer
  let customerId = user.email
    ? (
        await stripe.customers.list({
          email: user.email,
          limit: 1,
        })
      ).data[0]?.id
    : undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: {
        userId: userId.toString(),
        userName: user.name || "Unknown",
      },
    });
    customerId = (customer as any).id;
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: selectedPlan.stripePriceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      planId: planId.toString(),
    },
  });

  return session;
}

/**
 * Handle successful subscription from Stripe webhook
 */
export async function handleSubscriptionCreated(
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  stripePriceId: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get plan by Stripe price ID
  const plan = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.stripePriceId, stripePriceId));

  if (plan.length === 0) {
    throw new Error(`Plan not found for price ${stripePriceId}`);
  }

  // Get user by Stripe customer ID
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  const customerData = customer as any;
  if (!customerData.metadata?.userId) {
    throw new Error("User ID not found in customer metadata");
  }

  const userId = parseInt(customerData.metadata.userId);

  // Cancel any existing subscriptions for this user
  const existingSubscriptions = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId));

  for (const sub of existingSubscriptions) {
    if (sub.status !== "canceled") {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch (error) {
        console.error(`[Subscription] Failed to cancel subscription ${sub.stripeSubscriptionId}:`, error);
      }
    }
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Insert new subscription
  await db.insert(userSubscriptions).values({
    userId,
    planId: plan[0].id,
    stripeSubscriptionId,
    stripeCustomerId,
    status: subscription.status as string,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    predictionsUsedThisMonth: 0,
  });

  console.log(`[Subscription] Created subscription ${stripeSubscriptionId} for user ${userId}`);
}

/**
 * Handle subscription updated
 */
export async function handleSubscriptionUpdated(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Update subscription status
  await db
    .update(userSubscriptions)
    .set({
      status: subscription.status as string,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      canceledAt: (subscription as any).canceled_at ? new Date((subscription as any).canceled_at * 1000) : null,
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end ? 1 : 0,
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));

  console.log(`[Subscription] Updated subscription ${stripeSubscriptionId}`);
}

/**
 * Handle subscription deleted
 */
export async function handleSubscriptionDeleted(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(userSubscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));

  console.log(`[Subscription] Deleted subscription ${stripeSubscriptionId}`);
}

/**
 * Get user's current subscription
 */
export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subscription = await db
    .select()
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active")
      )
    );

  if (subscription.length === 0) return null;

  // Get plan details
  const plan = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, subscription[0].planId));

  return {
    ...subscription[0],
    plan: plan[0],
  };
}

/**
 * Check if user can make a prediction based on their subscription
 */
export async function canMakePrediction(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subscription = await getUserSubscription(userId);

  // If no active subscription, deny
  if (!subscription) return false;

  // If unlimited predictions, allow
  if (subscription.plan.predictionsPerMonth === -1) return true;

  // Check usage this month
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usage = await db
    .select()
    .from(predictionUsageLog)
    .where(
      and(
        eq(predictionUsageLog.userId, userId),
        eq(predictionUsageLog.month, currentMonth)
      )
    );

  const totalUsed = usage.reduce((sum, u) => sum + (u.predictionsUsed || 0), 0);
  return totalUsed < subscription.plan.predictionsPerMonth;
}

/**
 * Log a prediction usage
 */
export async function logPredictionUsage(userId: number, count: number = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Check if log exists for this month
  const existing = await db
    .select()
    .from(predictionUsageLog)
    .where(
      and(
        eq(predictionUsageLog.userId, userId),
        eq(predictionUsageLog.month, currentMonth)
      )
    );

  if (existing.length > 0) {
    // Update existing log
    await db
      .update(predictionUsageLog)
      .set({
        predictionsUsed: (existing[0].predictionsUsed || 0) + count,
      })
      .where(
        and(
          eq(predictionUsageLog.userId, userId),
          eq(predictionUsageLog.month, currentMonth)
        )
      );
  } else {
    // Create new log
    await db.insert(predictionUsageLog).values({
      userId,
      predictionsUsed: count,
      month: currentMonth,
    });
  }

  // Also update the subscription's monthly usage counter
  const subscription = await getUserSubscription(userId);
  if (subscription) {
    await db
      .update(userSubscriptions)
      .set({
        predictionsUsedThisMonth: (subscription.predictionsUsedThisMonth || 0) + count,
      })
      .where(eq(userSubscriptions.id, subscription.id));
  }
}

/**
 * Reset monthly prediction usage at period end
 */
export async function resetMonthlyUsage(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(userSubscriptions)
    .set({
      predictionsUsedThisMonth: 0,
    })
    .where(eq(userSubscriptions.userId, userId));
}

/**
 * Get user's prediction usage for current month
 */
export async function getPredictionUsage(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      isUnlimited: false,
    };
  }

  const limit = subscription.plan.predictionsPerMonth;
  const used = subscription.predictionsUsedThisMonth || 0;

  return {
    used,
    limit: limit === -1 ? 0 : limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    isUnlimited: limit === -1,
  };
}
