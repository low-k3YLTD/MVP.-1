import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingUp, Zap, Eye } from "lucide-react";

interface CorrelationResult {
  metric1: string;
  metric2: string;
  coefficient: number;
  strength: "strong" | "moderate" | "weak" | "none";
}

interface AnomalyResult {
  eventId: number;
  eventName: string;
  anomalyScore: number;
  severity: "critical" | "high" | "medium" | "low";
  reason: string;
}

interface TrendResult {
  metric: string;
  direction: "increasing" | "decreasing" | "stable";
  slope: number;
  rSquared: number;
  confidence: number;
}

interface PatternResult {
  patternId: string;
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  impact: "high" | "medium" | "low";
}

interface BlindSpot {
  id: string;
  title: string;
  description: string;
  signal: string;
  impact: "critical" | "high" | "medium";
  recommendation: string;
}

export function PatternInsights() {
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: analysis, isLoading } = trpc.patterns.analyzeWorkflows.useQuery(
    { days },
    { refetchInterval: 60000 } // Refetch every minute
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg animate-pulse" />
        <div className="h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Unable to load pattern analysis</AlertDescription>
      </Alert>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-900 text-red-100";
      case "high":
        return "bg-orange-900 text-orange-100";
      case "medium":
        return "bg-yellow-900 text-yellow-100";
      case "low":
        return "bg-blue-900 text-blue-100";
      default:
        return "bg-slate-700 text-slate-100";
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case "strong":
        return "text-cyan-400";
      case "moderate":
        return "text-cyan-300";
      case "weak":
        return "text-cyan-200";
      default:
        return "text-slate-400";
    }
  };

  const getTrendIcon = (direction: string) => {
    if (direction === "increasing") return "↑";
    if (direction === "decreasing") return "↓";
    return "→";
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Alert className="border-cyan-500/50 bg-cyan-500/10">
        <Zap className="h-4 w-4 text-cyan-400" />
        <AlertDescription className="text-cyan-100">{analysis.summary}</AlertDescription>
      </Alert>

      {/* Blind Spots */}
      {analysis.blindSpots && analysis.blindSpots.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Eye className="h-5 w-5" />
              Blind Spots Detected
            </CardTitle>
            <CardDescription>Signals we may be missing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.blindSpots.map((spot: BlindSpot) => (
              <div key={spot.id} className="space-y-2 p-3 rounded-lg bg-slate-800/50 border border-red-500/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-red-300">{spot.title}</h4>
                    <p className="text-sm text-slate-400">{spot.description}</p>
                  </div>
                  <Badge className={getSeverityColor(spot.impact)}>{spot.impact}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Signal:</span>
                    <p className="text-cyan-300">{spot.signal}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Recommendation:</span>
                    <p className="text-cyan-300">{spot.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed analysis */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="correlations">Correlations</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Correlations Found</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-400">{analysis.correlations?.length || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Anomalies Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-400">{analysis.anomalies?.length || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Active Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-400">{analysis.trends?.length || 0}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">Patterns Identified</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-400">{analysis.patterns?.length || 0}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Correlations Tab */}
        <TabsContent value="correlations" className="space-y-4">
          {analysis.correlations && analysis.correlations.length > 0 ? (
            <div className="space-y-3">
              {analysis.correlations.map((corr: CorrelationResult, idx: number) => (
                <Card key={idx} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">
                          {corr.metric1} ↔ {corr.metric2}
                        </p>
                        <p className={`text-sm font-medium ${getStrengthColor(corr.strength)}`}>
                          {corr.strength.charAt(0).toUpperCase() + corr.strength.slice(1)} correlation
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-400">{(corr.coefficient * 100).toFixed(0)}%</div>
                        <p className="text-xs text-slate-500">coefficient</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>No significant correlations detected</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {analysis.trends && analysis.trends.length > 0 ? (
            <div className="space-y-3">
              {analysis.trends.map((trend: TrendResult, idx: number) => (
                <Card key={idx} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">{trend.metric}</p>
                        <p className="text-sm text-slate-400">
                          Trend: {trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-400">
                          {getTrendIcon(trend.direction)}
                        </div>
                        <p className="text-xs text-slate-500">
                          R² = {(trend.rSquared * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>No significant trends detected</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          {analysis.patterns && analysis.patterns.length > 0 ? (
            <div className="space-y-3">
              {analysis.patterns.map((pattern: PatternResult, idx: number) => (
                <Card key={idx} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-100">{pattern.name}</p>
                          <p className="text-sm text-slate-400">{pattern.description}</p>
                        </div>
                        <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                          {pattern.impact}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Frequency:</span>
                          <p className="text-cyan-300 font-semibold">{pattern.frequency}x</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Confidence:</span>
                          <p className="text-cyan-300 font-semibold">{(pattern.confidence * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>No repeatable patterns detected yet</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* Anomalies */}
      {analysis.anomalies && analysis.anomalies.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-yellow-400">Recent Anomalies</CardTitle>
            <CardDescription>Unusual events in your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.anomalies.slice(0, 5).map((anomaly: AnomalyResult, idx: number) => (
              <div key={idx} className="flex items-start justify-between p-3 rounded-lg bg-slate-800/50 border border-yellow-500/20">
                <div>
                  <p className="font-semibold text-slate-100">{anomaly.eventName}</p>
                  <p className="text-xs text-slate-400">{anomaly.reason}</p>
                </div>
                <Badge className={getSeverityColor(anomaly.severity)}>{anomaly.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
