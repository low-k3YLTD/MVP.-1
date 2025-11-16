import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function Predict() {
  const { isAuthenticated } = useAuth();
  const [raceId, setRaceId] = useState("");
  const [features, setFeatures] = useState<Record<string, string>>({});
  const [predictions, setPredictions] = useState<any>(null);
  const [error, setError] = useState("");

  const predictMutation = trpc.prediction.predictRace.useMutation();
  const modelInfo = trpc.prediction.getModelInfo.useQuery();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-white">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">
              Please sign in to make predictions.
            </p>
            <Link href="/">
              <Button className="w-full">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePredict = async () => {
    setError("");
    setPredictions(null);

    try {
      // Convert string features to numbers
      const numericFeatures: Record<string, number> = {};
      for (const [key, value] of Object.entries(features)) {
        const num = parseFloat(value);
        if (isNaN(num)) {
          setError(`Invalid number for feature "${key}"`);
          return;
        }
        numericFeatures[key] = num;
      }

      const result = await predictMutation.mutateAsync({
        features: numericFeatures,
        raceId: raceId || undefined,
      });

      setPredictions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    }
  };

  const addFeature = () => {
    const newKey = `feature_${Object.keys(features).length + 1}`;
    setFeatures({ ...features, [newKey]: "" });
  };

  const removeFeature = (key: string) => {
    const newFeatures = { ...features };
    delete newFeatures[key];
    setFeatures(newFeatures);
  };

  const updateFeature = (key: string, value: string) => {
    setFeatures({ ...features, [key]: value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="text-white">
              ← Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-white">Make a Prediction</h1>
          <div className="w-20" />
        </div>
      </nav>

      <section className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Race Data Input</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter race features for prediction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Race ID */}
                <div>
                  <Label className="text-slate-300">Race ID (Optional)</Label>
                  <Input
                    value={raceId}
                    onChange={(e) => setRaceId(e.target.value)}
                    placeholder="e.g., race_2025_01_15"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Features */}
                <div>
                  <Label className="text-slate-300 mb-4 block">Race Features</Label>
                  <div className="space-y-3">
                    {Object.entries(features).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <Input
                          placeholder="Feature name"
                          value={key}
                          disabled
                          className="bg-slate-700 border-slate-600 text-slate-400"
                        />
                        <Input
                          placeholder="Value"
                          value={value}
                          onChange={(e) => updateFeature(key, e.target.value)}
                          type="number"
                          step="0.01"
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeFeature(key)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addFeature}
                    className="mt-4 text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    + Add Feature
                  </Button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handlePredict}
                  disabled={predictMutation.isPending || Object.keys(features).length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {predictMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Get Predictions
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Model Info & Results */}
          <div className="space-y-6">
            {/* Model Info */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Model Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {modelInfo.isLoading ? (
                  <p className="text-slate-400 text-sm">Loading...</p>
                ) : modelInfo.data ? (
                  <>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Status</p>
                      <p className="text-green-400 font-semibold">{modelInfo.data.status}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Ensemble NDCG@3</p>
                      <p className="text-blue-400 font-semibold">{modelInfo.data.ensemble.meanNdcg3.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Components</p>
                      <ul className="text-slate-300 text-sm space-y-1 mt-2">
                        {modelInfo.data.ensemble.components.map((comp) => (
                          <li key={comp}>• {comp}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            {/* Predictions */}
            {predictions && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-slate-400 text-xs uppercase">Race ID</p>
                      <p className="text-white font-mono text-sm">{predictions.raceId}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs uppercase mb-2">Rankings</p>
                      <div className="space-y-2">
                        {predictions.predictions.map((pred: any, idx: number) => (
                          <div key={idx} className="bg-slate-700/50 p-2 rounded">
                            <p className="text-white text-sm font-semibold">
                              #{pred.rank} {pred.horseName}
                            </p>
                            <p className="text-blue-400 text-xs">Score: {pred.score.toFixed(4)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
