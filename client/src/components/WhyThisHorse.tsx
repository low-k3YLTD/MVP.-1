import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, TrendingUp, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface WhyThisHorseProps {
  horseName: string;
  prediction: number;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export default function WhyThisHorse({
  horseName,
  prediction,
  isPremium = false,
  onUpgradeClick,
}: WhyThisHorseProps) {
  const [explanation, setExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mock explanation data (in production, fetch from API)
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setExplanation({
        headline: `We favor ${horseName} because of superior speed figure and form rating`,
        reasons: [
          { feature: "Speed Figure", impact: 0.34, direction: "positive", description: "Excellent" },
          { feature: "Form Rating", impact: 0.28, direction: "positive", description: "Strong" },
          { feature: "Jockey Rating", impact: 0.15, direction: "positive", description: "Above Average" },
          { feature: "Recent Performance", impact: -0.08, direction: "negative", description: "Slight concern" },
        ],
        confidence: 0.87,
        modelAgreement: 0.94,
        historicalValidation: {
          similarRaces: 23,
          winRate: 0.71,
        },
        riskFactors: ["Recent performance lag"],
        trustScore: 82,
      });
      setLoading(false);
    }, 500);
  }, [horseName]);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-black to-slate-900 border-amber-600/30">
        <CardHeader>
          <CardTitle className="text-amber-500">Why {horseName}?</CardTitle>
          <CardDescription>Loading explanation...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!explanation && !isPremium) {
    return (
      <Card className="bg-gradient-to-br from-black to-slate-900 border-amber-600/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-500">
            <Lock className="w-4 h-4" />
            Why {horseName}?
          </CardTitle>
          <CardDescription>Premium Feature</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300 mb-4">
            Unlock detailed SHAP-based explanations showing exactly why we picked this horse. Build confidence in your bets with transparent AI reasoning.
          </p>
          <Button
            onClick={onUpgradeClick}
            className="w-full bg-amber-600 hover:bg-amber-700 text-black font-semibold"
          >
            Upgrade to Premium
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!explanation) return null;

  // Confidence level badge
  const confidenceLevel =
    explanation.confidence > 0.8
      ? { label: "Very High", color: "bg-green-500/20 text-green-400" }
      : explanation.confidence > 0.6
        ? { label: "High", color: "bg-blue-500/20 text-blue-400" }
        : explanation.confidence > 0.4
          ? { label: "Medium", color: "bg-yellow-500/20 text-yellow-400" }
          : { label: "Low", color: "bg-red-500/20 text-red-400" };

  // Trust badge
  const trustBadge =
    explanation.trustScore > 75
      ? { label: "High Trust", color: "bg-green-500/20 text-green-400" }
      : explanation.trustScore > 50
        ? { label: "Medium Trust", color: "bg-yellow-500/20 text-yellow-400" }
        : { label: "Low Trust", color: "bg-red-500/20 text-red-400" };

  return (
    <Card className="bg-gradient-to-br from-black to-slate-900 border-amber-600/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-amber-500">Why {horseName}?</CardTitle>
            <CardDescription className="mt-2">{explanation.headline}</CardDescription>
          </div>
          <Badge className={trustBadge.color}>{trustBadge.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Confidence & Agreement */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Confidence</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-lg font-semibold text-amber-500">
                {(explanation.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className={`text-xs mt-1 ${confidenceLevel.color}`}>{confidenceLevel.label}</div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Model Agreement</div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-lg font-semibold text-green-400">
                {(explanation.modelAgreement * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-green-400 mt-1">Very Strong</div>
          </div>
        </div>

        {/* Top Reasons */}
        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Top Reasons</h4>
          <div className="space-y-2">
            {explanation.reasons.map((reason: any, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3 border border-slate-700"
              >
                {reason.direction === "positive" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-200">{reason.feature}</span>
                    <span className="text-xs text-slate-400">
                      {reason.direction === "positive" ? "+" : ""}
                      {reason.impact.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{reason.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Validation */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">Historical Validation</h4>
          <p className="text-sm text-slate-300">
            In <span className="font-semibold text-cyan-400">{explanation.historicalValidation.similarRaces}</span> similar races, horses with this profile won{" "}
            <span className="font-semibold text-cyan-400">
              {(explanation.historicalValidation.winRate * 100).toFixed(0)}%
            </span>{" "}
            of the time
          </p>
        </div>

        {/* Risk Factors */}
        {explanation.riskFactors && explanation.riskFactors.length > 0 && (
          <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
            <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Risk Factors
            </h4>
            <ul className="text-sm text-red-300 space-y-1">
              {explanation.riskFactors.map((risk: string, idx: number) => (
                <li key={idx}>• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 border-slate-600 hover:bg-slate-800">
            See Comparison
          </Button>
          <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-black font-semibold">
            Bet Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
