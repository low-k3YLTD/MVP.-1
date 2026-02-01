import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Play, Pause, TrendingUp, Target, Zap, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function AutomationDashboard() {
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Queries
  const statusQuery = trpc.automation.getStatus.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const livePredictionsQuery = trpc.automation.getLivePredictions.useQuery(
    { limit: 10, offset: 0 },
    { refetchInterval: 30000 }
  );

  const raceResultsQuery = trpc.automation.getRaceResults.useQuery(
    { limit: 10, offset: 0 },
    { refetchInterval: 30000 }
  );

  const dailyStatsQuery = trpc.automation.getDailyStats.useQuery(
    { days: 30 },
    { refetchInterval: 60000 }
  );

  const performanceQuery = trpc.automation.getPerformanceMetrics.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Mutations
  const startMutation = trpc.automation.start.useMutation({
    onSuccess: () => {
      setAutomationEnabled(true);
      toast.success("Automation started!");
      statusQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to start automation: ${error.message}`);
    },
  });

  const stopMutation = trpc.automation.stop.useMutation({
    onSuccess: () => {
      setAutomationEnabled(false);
      toast.success("Automation stopped!");
      statusQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to stop automation: ${error.message}`);
    },
  });

  useEffect(() => {
    if (statusQuery.data?.isRunning !== undefined) {
      setAutomationEnabled(statusQuery.data.isRunning);
    }
  }, [statusQuery.data?.isRunning]);

  const handleToggleAutomation = async () => {
    setLoading(true);
    try {
      if (automationEnabled) {
        await stopMutation.mutateAsync();
      } else {
        await startMutation.mutateAsync();
      }
    } finally {
      setLoading(false);
    }
  };

  const stats = statusQuery.data?.stats;
  const performance = performanceQuery.data;
  const predictions = livePredictionsQuery.data?.predictions || [];
  const results = raceResultsQuery.data?.results || [];
  const dailyStats = dailyStatsQuery.data?.stats || [];

  // Prepare chart data
  const chartData = dailyStats.map((stat) => ({
    date: new Date(stat.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    predictions: stat.totalPredictionsGenerated || 0,
    results: stat.totalResultsFetched || 0,
    profit: (stat.totalProfit || 0) / 100, // Convert from cents
  }));

  const accuracyData = [
    { name: "Correct", value: performance?.topPickAccuracy || 0 },
    { name: "Incorrect", value: 100 - (performance?.topPickAccuracy || 0) },
  ];

  const COLORS = ["#10b981", "#ef4444"];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Automation Dashboard</h1>
              <p className="text-muted-foreground">Monitor continuous race predictions and performance metrics</p>
            </div>
            <Button
              onClick={handleToggleAutomation}
              disabled={loading}
              variant={automationEnabled ? "destructive" : "default"}
              size="lg"
              className="gap-2"
            >
              {automationEnabled ? (
                <>
                  <Pause className="w-4 h-4" />
                  Stop Automation
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Automation
                </>
              )}
            </Button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge variant={automationEnabled ? "default" : "secondary"} className="px-3 py-1">
              <span className={`w-2 h-2 rounded-full mr-2 ${automationEnabled ? "bg-green-500" : "bg-gray-500"}`} />
              {automationEnabled ? "Running" : "Stopped"}
            </Badge>
            {stats && (
              <span className="text-sm text-muted-foreground">
                Processed {stats.totalRacesDetected || 0} races • {stats.totalPredictionsGenerated || 0} predictions
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        {performance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Pick Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{performance.topPickAccuracy}%</span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{performance.completedRaces} races completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Place Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{performance.topPickPlaceAccuracy}%</span>
                  <Target className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Top 4 finishers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit/Loss</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${performance.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${(performance.totalProfit / 100).toFixed(2)}
                  </span>
                  <DollarSign className="w-4 h-4 text-yellow-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Based on $10 bets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${performance.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {performance.roi}%
                  </span>
                  <Zap className="w-4 h-4 text-purple-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Return on investment</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts and Data */}
        <Tabs defaultValue="predictions" className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="predictions">Live Predictions</TabsTrigger>
            <TabsTrigger value="results">Results & Accuracy</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Live Predictions Tab */}
          <TabsContent value="predictions">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Race Predictions</CardTitle>
                <CardDescription>Auto-generated predictions for upcoming races</CardDescription>
              </CardHeader>
              <CardContent>
                {predictions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No predictions generated yet. Start automation to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {predictions.map((pred: any) => (
                      <div key={pred.id} className="border rounded-lg p-4 hover:bg-accent transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{pred.raceName}</h3>
                            <p className="text-sm text-muted-foreground">{pred.trackName} • {new Date(pred.raceTime).toLocaleString()}</p>
                          </div>
                          <Badge variant="outline">{pred.topPickScore}% confidence</Badge>
                        </div>

                        <div className="bg-muted p-3 rounded mb-3">
                          <p className="text-sm font-medium text-foreground mb-1">Top Pick</p>
                          <p className="text-lg font-bold text-green-600">{pred.topPick}</p>
                        </div>

                        {pred.predictions && pred.predictions.length > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-foreground mb-2">Predicted Order</p>
                            <div className="space-y-1">
                              {(pred.predictions as any[]).slice(0, 4).map((horse: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-muted-foreground">
                                  <span>
                                    {idx + 1}. {horse.name}
                                  </span>
                                  <span>{horse.winProbability}% win prob</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Race Results & Accuracy</CardTitle>
                <CardDescription>Completed races with prediction accuracy</CardDescription>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No results available yet. Races will appear here once completed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {results.map((result: any) => (
                      <div key={result.raceId} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{result.raceName}</h3>
                            <p className="text-sm text-muted-foreground">{new Date(result.raceTime).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            {result.topPickCorrect === 1 && (
                              <Badge className="bg-green-600">✓ Win</Badge>
                            )}
                            {result.topPickPlaced === 1 && result.topPickCorrect !== 1 && (
                              <Badge className="bg-blue-600">✓ Placed</Badge>
                            )}
                            {result.topPickCorrect !== 1 && result.topPickPlaced !== 1 && (
                              <Badge variant="destructive">✗ Lost</Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Predicted</p>
                            <p className="font-semibold text-foreground">{result.topPick}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Winner</p>
                            <p className="font-semibold text-foreground">{result.winner}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Prediction Confidence</p>
                            <p className="font-semibold text-foreground">{result.topPickWinProbability}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Profit/Loss</p>
                            <p className={`font-semibold ${result.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                              ${(result.profitLoss / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Performance Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>30-Day Performance Trend</CardTitle>
                    <CardDescription>Predictions generated and profit/loss over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="predictions"
                          stroke="#3b82f6"
                          name="Predictions"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="profit"
                          stroke="#10b981"
                          name="Profit ($)"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Accuracy Distribution */}
              {performance && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Win Prediction Accuracy</CardTitle>
                      <CardDescription>Percentage of correct top picks</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={accuracyData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Summary Statistics</CardTitle>
                      <CardDescription>Overall performance metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-muted-foreground">Total Predictions</span>
                        <span className="font-semibold">{performance.totalPredictions}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-muted-foreground">Completed Races</span>
                        <span className="font-semibold">{performance.completedRaces}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-muted-foreground">Win Accuracy</span>
                        <span className="font-semibold text-green-600">{performance.topPickAccuracy}%</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-muted-foreground">Place Accuracy</span>
                        <span className="font-semibold text-blue-600">{performance.topPickPlaceAccuracy}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total ROI</span>
                        <span className={`font-semibold ${performance.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {performance.roi}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
