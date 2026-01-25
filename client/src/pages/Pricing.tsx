import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Plan {
  id: number;
  name: string;
  priceInCents: number;
  billingPeriod: string;
  predictionsPerMonth: number;
  hasApiAccess: number;
  features: any;
  displayOrder: number | null;
  stripeProductId: string;
  stripePriceId: string;
  description: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  const { data: plansData } = trpc.subscription.getPlans.useQuery();
  const { data: currentSubscription } = trpc.subscription.getCurrentSubscription.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const checkoutMutation = trpc.subscription.createCheckout.useMutation();

  useEffect(() => {
    if (plansData) {
      const sorted = [...plansData].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setPlans(sorted);
      setLoading(false);
    }
  }, [plansData]);

  const handleSelectPlan = async (planId: number) => {
    if (!isAuthenticated) {
      toast.error("Please sign in to subscribe");
      setLocation("/");
      return;
    }

    setSelectedPlan(planId);
    setProcessingCheckout(true);

    try {
      const baseUrl = window.location.origin;
      const result = await checkoutMutation.mutateAsync({
        planId,
        successUrl: `${baseUrl}/subscription-success`,
        cancelUrl: `${baseUrl}/pricing`,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create checkout session");
      setProcessingCheckout(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white">Loading plans...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Subscription Plans</h1>
          <p className="text-xl text-slate-300">
            Choose the perfect plan for your horse racing predictions
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const isCurrentPlan =
              currentSubscription?.planId === plan.id;
            const isMostPopular = plan.name === "Pro";

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isMostPopular
                    ? "border-blue-500 border-2 shadow-xl shadow-blue-500/20"
                    : "border-slate-700"
                } bg-slate-800 text-white`}
              >
                {isMostPopular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                    Most Popular
                  </Badge>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {plan.predictionsPerMonth === -1
                      ? "Unlimited predictions"
                      : `${plan.predictionsPerMonth} predictions/month`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {/* Price */}
                  <div className="mb-6">
                    <div className="text-4xl font-bold text-white mb-2">
                      {formatPrice(plan.priceInCents)}
                    </div>
                    <div className="text-slate-400">
                      per {plan.billingPeriod === "monthly" ? "month" : "year"}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="mb-8 flex-1">
                    <div className="space-y-3">
                      {(Array.isArray(plan.features) ? plan.features : []).map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || processingCheckout}
                    className={`w-full ${
                      isCurrentPlan
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : isMostPopular
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    {isCurrentPlan
                      ? "Current Plan"
                      : processingCheckout && selectedPlan === plan.id
                        ? "Processing..."
                        : "Subscribe Now"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-slate-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect
                immediately.
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What happens when I exceed my prediction limit?
              </h3>
              <p className="text-slate-300">
                You'll be notified when you reach your limit. You can upgrade to a higher tier
                to continue making predictions.
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Is there a free trial?
              </h3>
              <p className="text-slate-300">
                Contact our support team to discuss trial options for enterprise customers.
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What does API access include?
              </h3>
              <p className="text-slate-300">
                Premium members get full API access to integrate predictions into their own
                applications, plus webhook support for real-time updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
