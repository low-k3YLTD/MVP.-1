/**
 * Enhanced Metrics Dashboard
 * Integrates superior visualization from Equine Oracle admin
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface ModelMetrics {
  ndcg4: number;
  calibrationError: number;
  latencyMs: number;
  accuracy: number;
  rocAuc: number;
  lastUpdated: Date;
  modelVersion: string;
  status: "healthy" | "degraded" | "critical";
}

interface EnhancedMetricsDashboardProps {
  metrics?: ModelMetrics;
  historicalData?: Array<{
    timestamp: string;
    accuracy: number;
    rocAuc: number;
    latency: number;
  }>;
  modelBreakdown?: Array<{
    model: string;
    accuracy: number;
    rocAuc: number;
    weight: number;
  }>;
}

const DEFAULT_METRICS: ModelMetrics = {
  ndcg4: 0.9763,
  calibrationError: 0.0518,
  latencyMs: 93.3,
  accuracy: 0.78,
  rocAuc: 0.82,
  lastUpdated: new Date(),
  modelVersion: "2.0-oracle",
  status: "healthy",
};

const DEFAULT_HISTORICAL_DATA = [
  { timestamp: "00:00", accuracy: 0.75, rocAuc: 0.80, latency: 95 },
  { timestamp: "04:00", accuracy: 0.76, rocAuc: 0.81, latency: 92 },
  { timestamp: "08:00", accuracy: 0.77, rocAuc: 0.815, latency: 91 },
  { timestamp: "12:00", accuracy: 0.78, rocAuc: 0.82, latency: 93 },
  { timestamp: "16:00", accuracy: 0.78, rocAuc: 0.82, latency: 94 },
  { timestamp: "20:00", accuracy: 0.78, rocAuc: 0.82, latency: 93 },
];

const DEFAULT_MODEL_BREAKDOWN = [
  { model: "LightGBM New", accuracy: 0.79, rocAuc: 0.83, weight: 0.35 },
  { model: "XGBoost", accuracy: 0.77, rocAuc: 0.81, weight: 0.25 },
  { model: "Logistic Reg", accuracy: 0.75, rocAuc: 0.79, weight: 0.20 },
  { model: "LightGBM Old", accuracy: 0.74, rocAuc: 0.78, weight: 0.20 },
];

const RADAR_DATA = [
  { metric: "Accuracy", value: 78, fullMark: 100 },
  { metric: "ROC-AUC", value: 82, fullMark: 100 },
  { metric: "NDCG@4", value: 97.63, fullMark: 100 },
  { metric: "Latency", value: 90, fullMark: 100 },
  { metric: "Calibration", value: 94.82, fullMark: 100 },
];

export default function EnhancedMetricsDashboard({
  metrics = DEFAULT_METRICS,
  historicalData = DEFAULT_HISTORICAL_DATA,
  modelBreakdown = DEFAULT_MODEL_BREAKDOWN,
}: EnhancedMetricsDashboardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800 border-green-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status Card */}
      <Card className="shadow-lg border-2 border-blue-400">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6" />
              <div>
                <CardTitle>Model Performance Dashboard</CardTitle>
                <CardDescription className="text-blue-100">
                  Real-time metrics for advanced ensemble
                </CardDescription>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${getStatusColor(
                metrics.status
              )}`}
            >
              {getStatusIcon(metrics.status)}
              <span className="font-semibold capitalize">{metrics.status}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Accuracy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Accuracy</span>
                <Badge variant="secondary">{(metrics.accuracy * 100).toFixed(1)}%</Badge>
              </div>
              <Progress value={metrics.accuracy * 100} className="h-2" />
            </div>

            {/* ROC-AUC */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">ROC-AUC</span>
                <Badge variant="secondary">{(metrics.rocAuc * 100).toFixed(1)}%</Badge>
              </div>
              <Progress value={metrics.rocAuc * 100} className="h-2" />
            </div>

            {/* NDCG@4 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">NDCG@4</span>
                <Badge variant="secondary">{(metrics.ndcg4 * 100).toFixed(2)}%</Badge>
              </div>
              <Progress value={metrics.ndcg4 * 100} className="h-2" />
            </div>

            {/* Latency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Latency</span>
                <Badge variant="secondary">{metrics.latencyMs.toFixed(1)}ms</Badge>
              </div>
              <Progress value={Math.min((metrics.latencyMs / 200) * 100, 100)} className="h-2" />
            </div>

            {/* Calibration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Calibration</span>
                <Badge variant="secondary">{(metrics.calibrationError * 100).toFixed(2)}%</Badge>
              </div>
              <Progress
                value={Math.max(100 - metrics.calibrationError * 100, 0)}
                className="h-2"
              />
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Last updated: {metrics.lastUpdated.toLocaleTimeString()} | Version: {metrics.modelVersion}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance Trends</TabsTrigger>
          <TabsTrigger value="models">Model Breakdown</TabsTrigger>
          <TabsTrigger value="radar">Metrics Overview</TabsTrigger>
        </TabsList>

        {/* Performance Trends */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Historical Performance</CardTitle>
              <CardDescription>Accuracy and ROC-AUC trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" name="Accuracy" />
                  <Line type="monotone" dataKey="rocAuc" stroke="#10b981" name="ROC-AUC" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Breakdown */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Model Ensemble Breakdown</CardTitle>
              <CardDescription>Individual model performance and weights</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="model" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy" />
                  <Bar dataKey="rocAuc" fill="#10b981" name="ROC-AUC" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 space-y-3">
                {modelBreakdown.map((model) => (
                  <div key={model.model} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{model.model}</span>
                      <Badge variant="outline">{(model.weight * 100).toFixed(0)}%</Badge>
                    </div>
                    <Progress value={model.weight * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Radar Chart */}
        <TabsContent value="radar">
          <Card>
            <CardHeader>
              <CardTitle>Metrics Overview</CardTitle>
              <CardDescription>Multi-dimensional performance view</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
