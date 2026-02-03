import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Loader2, TrendingUp, Target, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function PredictionHistory() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [selectedPrediction, setSelectedPrediction] = useState<number | null>(null);

  // Fetch prediction history
  const { data: predictions, isLoading: predictionsLoading } = trpc.prediction.getHistory.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated && !authLoading }
  );

  // Fetch prediction statistics
  const { data: stats, isLoading: statsLoading } = trpc.prediction.getStats.useQuery(
    undefined,
    { enabled: isAuthenticated && !authLoading }
  );

  const updateOutcomeMutation = trpc.prediction.updateOutcome.useMutation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">Prediction History</h1>
        <p className="text-muted-foreground">Please log in to view your prediction history.</p>
        <Link href="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    );
  }

  const isLoading = predictionsLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Prediction History</h1>
          <p className="text-muted-foreground">Track your predictions and analyze your accuracy over time.</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Total Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPredictions}</div>
                <p className="text-xs text-muted-foreground">All-time predictions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.accuracyPercentage}%</div>
                <p className="text-xs text-muted-foreground">{stats.correctPredictions} correct</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Avg Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.averageConfidence}%</div>
                <p className="text-xs text-muted-foreground">Average prediction confidence</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Best Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.bestStreak}</div>
                <p className="text-xs text-muted-foreground">Consecutive correct predictions</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Predictions List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Predictions</CardTitle>
            <CardDescription>View and manage your prediction history</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin w-6 h-6" />
              </div>
            ) : predictions && predictions.length > 0 ? (
              <div className="space-y-4">
                {predictions.map((pred) => (
                  <div
                    key={pred.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{pred.horseName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Race: {pred.raceName || pred.raceId}
                        </p>
                        {pred.raceDate && (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(pred.raceDate), "MMM dd, yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant={pred.status === "completed" ? "default" : "outline"}>
                          {pred.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Predicted Rank</p>
                        <p className="font-semibold">#{pred.predictedRank}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Confidence</p>
                        <p className="font-semibold">{pred.confidenceScore}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Actual Rank</p>
                        <p className="font-semibold">{pred.actualRank ? `#${pred.actualRank}` : "Pending"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Result</p>
                        {pred.isCorrect === null ? (
                          <p className="font-semibold text-yellow-600">Pending</p>
                        ) : pred.isCorrect === 1 ? (
                          <p className="font-semibold text-green-600">✓ Correct</p>
                        ) : (
                          <p className="font-semibold text-red-600">✗ Incorrect</p>
                        )}
                      </div>
                    </div>

                    {pred.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const actualRank = prompt("Enter actual rank (1-10):");
                            if (actualRank) {
                              const rank = parseInt(actualRank);
                              const isCorrect = rank === pred.predictedRank;
                              updateOutcomeMutation.mutate({
                                predictionId: pred.id,
                                actualRank: rank,
                                isCorrect,
                              });
                            }
                          }}
                        >
                          Mark Completed
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No predictions yet.</p>
                <Link href="/predict">
                  <Button>Make Your First Prediction</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
