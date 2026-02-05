import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TestMetrics {
  predictions: number;
  wins: number;
  avg_ndcg: number;
  win_rate: number;
}

interface ABTest {
  test_id: string;
  status: 'active' | 'concluded';
  control: TestMetrics;
  treatment: TestMetrics;
  improvement_percent: number;
  is_significant: boolean;
}

export default function ABTesting() {
  const [tests] = useState<ABTest[]>([
    {
      test_id: 'ensemble-v1-vs-v2',
      status: 'active',
      control: {
        predictions: 1250,
        wins: 312,
        avg_ndcg: 0.847,
        win_rate: 0.2496,
      },
      treatment: {
        predictions: 1243,
        wins: 328,
        avg_ndcg: 0.863,
        win_rate: 0.2637,
      },
      improvement_percent: 1.89,
      is_significant: true,
    },
  ]);

  const getImprovementColor = (improvement: number) => {
    if (improvement > 2) return 'text-green-500';
    if (improvement > 0) return 'text-emerald-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gold mb-2">A/B Testing Dashboard</h1>
          <p className="text-grey-400">Monitor ensemble weight optimization experiments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Active Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">
                {tests.filter((t) => t.status === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Avg Improvement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getImprovementColor(tests[0]?.improvement_percent || 0)}`}>
                {tests[0]?.improvement_percent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Significant Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">
                {tests.filter((t) => t.is_significant).length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-black/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-grey-400">Total Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold">
                {tests.reduce((sum, t) => sum + t.control.predictions + t.treatment.predictions, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tests.map((test) => (
            <Card key={test.test_id} className="border-gold/30 bg-black/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gold">{test.test_id}</CardTitle>
                  <Badge className="bg-gold text-black">{test.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gold">Control</h4>
                    <div className="text-xs text-grey-400 space-y-1">
                      <div>Predictions: {test.control.predictions}</div>
                      <div>Wins: {test.control.wins}</div>
                      <div>NDCG: {test.control.avg_ndcg.toFixed(3)}</div>
                      <div>Win Rate: {(test.control.win_rate * 100).toFixed(2)}%</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gold">Treatment</h4>
                    <div className="text-xs text-grey-400 space-y-1">
                      <div>Predictions: {test.treatment.predictions}</div>
                      <div>Wins: {test.treatment.wins}</div>
                      <div>NDCG: {test.treatment.avg_ndcg.toFixed(3)}</div>
                      <div>Win Rate: {(test.treatment.win_rate * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gold/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-grey-400">Improvement</span>
                    <span className={`text-lg font-bold ${getImprovementColor(test.improvement_percent)}`}>
                      {test.improvement_percent > 0 ? '+' : ''}{test.improvement_percent.toFixed(2)}%
                    </span>
                  </div>
                  {test.is_significant && (
                    <div className="mt-2 text-xs text-gold bg-gold/10 p-2 rounded">
                      Statistically Significant
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
