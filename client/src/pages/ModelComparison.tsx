import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { trpc } from '@/lib/trpc';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface ModelMetrics {
  modelId: string;
  modelName: string;
  version: string;
  ndcgAt3: number;
  ndcgAt5: number;
  winAccuracy: number;
  placeAccuracy: number;
  showAccuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  averageConfidence: number;
  roi: number;
  lastUpdated: string | Date;
  driftScore?: number;
  conceptDrift?: number;
}

interface DriftAlert {
  alertId: string;
  modelId: string;
  alertType: 'data_drift' | 'prediction_drift' | 'concept_drift' | 'performance_drift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  driftMagnitude: number;
  threshold: number;
  message: string;
  timestamp: string | Date;
  requiresRetraining: boolean;
}

export default function ModelComparison() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [ndcgHistory, setNdcgHistory] = useState<any[]>([]);

  // Fetch model metrics
  const { data: metricsData, isLoading: metricsLoading } = trpc.outcome.getModelMetrics.useQuery();
  const { data: weightsData } = trpc.outcome.getModelWeights.useQuery();
  const { data: driftData } = trpc.outcome.getDriftAlerts.useQuery();
  const { data: abTestsData } = trpc.outcome.getABTests.useQuery();

  // Generate mock NDCG history for visualization
  useEffect(() => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      ndcg: 0.85 + Math.random() * 0.12,
      winAccuracy: 0.24 + Math.random() * 0.08,
    }));
    setNdcgHistory(history);
  }, []);

  const models = metricsData?.models || [];
  const summary = metricsData?.summary;
  const weights = weightsData?.weights || [];
  const alerts = driftData?.allAlerts || [];
  const criticalAlerts = driftData?.criticalAlerts || [];
  const shouldRetrain = driftData?.shouldRetrain || false;
  const abTests = abTestsData?.activeTests || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default: return 'bg-grey-500/20 text-grey-400 border-grey-500/50';
    }
  };

  const getDriftTypeLabel = (type: string) => {
    switch (type) {
      case 'data_drift': return 'Data Drift';
      case 'prediction_drift': return 'Prediction Drift';
      case 'concept_drift': return 'Concept Drift';
      case 'performance_drift': return 'Performance Drift';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gold mb-2">Model Comparison Dashboard</h1>
          <p className="text-grey-400">Monitor NDCG@3, model weights, and drift detection</p>
        </div>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-red-400 font-semibold mb-2">Critical Drift Detected</h3>
                <p className="text-red-300 text-sm">
                  {criticalAlerts.length} critical alert(s) require attention. Retraining recommended.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Best NDCG@3</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">
                {summary?.bestModel?.ndcgAt3.toFixed(3) || '0.000'}
              </div>
              <p className="text-xs text-grey-500 mt-1">{summary?.bestModel?.modelName}</p>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Average NDCG@3</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">
                {summary?.averageNDCG.toFixed(3) || '0.000'}
              </div>
              <p className="text-xs text-grey-500 mt-1">
                Variance: {summary?.ndcgVariance.toFixed(4) || '0.0000'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Active Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">{models.length}</div>
              <p className="text-xs text-grey-500 mt-1">
                {weights.filter((w) => w.weight > 0).length} weighted
              </p>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Drift Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">{alerts.length}</div>
              <p className={`text-xs mt-1 ${criticalAlerts.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {criticalAlerts.length} critical
              </p>
            </CardContent>
          </Card>
        </div>

        {/* NDCG Trend Chart */}
        <Card className="border-gold/30 bg-black/40">
          <CardHeader>
            <CardTitle className="text-gold">NDCG@3 Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ndcgHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" domain={[0.7, 1]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #D4AF37' }}
                  labelStyle={{ color: '#D4AF37' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ndcg"
                  stroke="#D4AF37"
                  dot={false}
                  name="NDCG@3"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Model Performance Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Models Table */}
          <Card className="border-gold/30 bg-black/40">
            <CardHeader>
              <CardTitle className="text-gold">Model Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {models.map((model: ModelMetrics) => (
                  <div
                    key={model.modelId}
                    onClick={() => setSelectedModel(model.modelId)}
                    className={`p-3 rounded border cursor-pointer transition ${
                      selectedModel === model.modelId
                        ? 'border-gold/50 bg-gold/10'
                        : 'border-gold/20 bg-black/20 hover:border-gold/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-gold font-semibold">{model.modelName}</h4>
                      <Badge className="bg-gold/20 text-gold text-xs">{model.version}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-grey-500">NDCG@3</p>
                        <p className="text-gold font-semibold">{model.ndcgAt3.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-grey-500">Win Acc</p>
                        <p className="text-gold font-semibold">{model.winAccuracy.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-grey-500">ROI</p>
                        <p className={`font-semibold ${model.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {model.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Model Weights */}
          <Card className="border-gold/30 bg-black/40">
            <CardHeader>
              <CardTitle className="text-gold">Ensemble Weights</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weights}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="modelId"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #D4AF37' }}
                    labelStyle={{ color: '#D4AF37' }}
                  />
                  <Bar dataKey="weight" fill="#D4AF37" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Drift Alerts */}
        {alerts.length > 0 && (
          <Card className="border-gold/30 bg-black/40">
            <CardHeader>
              <CardTitle className="text-gold">Recent Drift Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {alerts.slice(0, 10).map((alert: DriftAlert) => (
                  <div
                    key={alert.alertId}
                    className={`p-3 rounded border ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{getDriftTypeLabel(alert.alertType)}</p>
                        <p className="text-sm mt-1">{alert.message}</p>
                        <p className="text-xs mt-2 opacity-75">
                          Magnitude: {alert.driftMagnitude.toFixed(3)} (threshold: {alert.threshold.toFixed(3)})
                        </p>
                      </div>
                      {alert.requiresRetraining && (
                        <Badge className="bg-red-500/20 text-red-400 text-xs">Retrain</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* A/B Tests */}
        {abTests.length > 0 && (
          <Card className="border-gold/30 bg-black/40">
            <CardHeader>
              <CardTitle className="text-gold">Active A/B Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {abTests.map((test: any) => (
                  <div key={test.testId} className="p-4 border border-gold/20 rounded">
                    <h4 className="text-gold font-semibold mb-3">{test.testId}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-grey-400">Control NDCG</span>
                        <span className="text-gold">{test.controlNDCG.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-grey-400">Treatment NDCG</span>
                        <span className="text-gold">{test.treatmentNDCG.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-grey-400">Improvement</span>
                        <span className={test.improvement >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {test.improvement > 0 ? '+' : ''}{test.improvement.toFixed(2)}%
                        </span>
                      </div>
                      {test.isSignificant && (
                        <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-xs">
                          Statistically Significant
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
