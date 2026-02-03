import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface RaceFormData {
  raceId: string;
  trackType: string;
  distance: string;
  raceClass: string;
  weather: string;
  numHorses: string;
  horseNames: string[];
}

interface SimplePredictFormProps {
  onPredictionsReceived?: (predictions: any) => void;
}

export default function SimplePredictForm({ onPredictionsReceived }: SimplePredictFormProps) {
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState<RaceFormData>({
    raceId: "",
    trackType: "turf",
    distance: "1600",
    raceClass: "class2",
    weather: "clear",
    numHorses: "8",
    horseNames: Array(8).fill(""),
  });

  const [predictions, setPredictions] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const predictMutation = trpc.prediction.predictRace.useMutation();
  const savePredictionMutation = trpc.prediction.savePredictionHistory.useMutation();
  const mockRacesQuery = trpc.prediction.getMockRaces.useQuery();
  const randomRaceQuery = trpc.prediction.getRandomRace.useQuery();
  const liveRacesQuery = trpc.prediction.getUpcomingRaces.useQuery(
    { provider: "auto" },
    { refetchInterval: 30000 } // Refetch every 30 seconds
  );

  const loadSampleRace = (raceData: any) => {
    const numHorses = raceData.horses.length;
    setFormData({
      raceId: raceData.id,
      trackType: raceData.track,
      distance: raceData.distance,
      raceClass: raceData.raceClass,
      weather: raceData.weather,
      numHorses: numHorses.toString(),
      horseNames: raceData.horses,
    });
    setPredictions(null);
    setError("");
  };

  const loadRandomRace = async () => {
    const race = await randomRaceQuery.refetch();
    if (race.data) {
      loadSampleRace(race.data);
    }
  };

  // Track types
  const trackTypes = [
    { value: "turf", label: "Turf (Grass)" },
    { value: "dirt", label: "Dirt" },
    { value: "synthetic", label: "Synthetic" },
  ];

  // Race distances (in meters)
  const distances = [
    { value: "1000", label: "1000m (Sprint)" },
    { value: "1200", label: "1200m (Sprint)" },
    { value: "1400", label: "1400m (Mile)" },
    { value: "1600", label: "1600m (Classic)" },
    { value: "2000", label: "2000m (Long)" },
    { value: "2400", label: "2400m (Staying)" },
  ];

  // Race classes
  const raceClasses = [
    { value: "class1", label: "Class 1 (Elite)" },
    { value: "class2", label: "Class 2 (Premium)" },
    { value: "class3", label: "Class 3 (Standard)" },
    { value: "class4", label: "Class 4 (Maiden)" },
  ];

  // Weather conditions
  const weatherConditions = [
    { value: "clear", label: "Clear" },
    { value: "overcast", label: "Overcast" },
    { value: "light_rain", label: "Light Rain" },
    { value: "heavy_rain", label: "Heavy Rain" },
    { value: "fog", label: "Fog" },
  ];

  // Number of horses
  const horseCountOptions = [
    { value: "6", label: "6 Horses" },
    { value: "8", label: "8 Horses" },
    { value: "10", label: "10 Horses" },
    { value: "12", label: "12 Horses" },
    { value: "14", label: "14 Horses" },
  ];

  const handleNumHorsesChange = (value: string) => {
    const count = parseInt(value);
    setFormData({
      ...formData,
      numHorses: value,
      horseNames: Array(count).fill(""),
    });
  };

  const handleHorseNameChange = (index: number, name: string) => {
    const newNames = [...formData.horseNames];
    newNames[index] = name;
    setFormData({ ...formData, horseNames: newNames });
  };

  const handlePredict = async () => {
    setError("");
    setPredictions(null);
    setLoading(true);

    try {
      // Validate horse names
      const validNames = formData.horseNames.filter((name) => name.trim());
      if (validNames.length === 0) {
        setError("Please enter at least one horse name");
        setLoading(false);
        return;
      }

      // Create features from dropdown selections
      const features: Record<string, number> = {
        track_type_turf: formData.trackType === "turf" ? 1 : 0,
        track_type_dirt: formData.trackType === "dirt" ? 1 : 0,
        track_type_synthetic: formData.trackType === "synthetic" ? 1 : 0,
        distance: parseInt(formData.distance),
        race_class_1: formData.raceClass === "class1" ? 1 : 0,
        race_class_2: formData.raceClass === "class2" ? 1 : 0,
        race_class_3: formData.raceClass === "class3" ? 1 : 0,
        race_class_4: formData.raceClass === "class4" ? 1 : 0,
        weather_clear: formData.weather === "clear" ? 1 : 0,
        weather_overcast: formData.weather === "overcast" ? 1 : 0,
        weather_light_rain: formData.weather === "light_rain" ? 1 : 0,
        weather_heavy_rain: formData.weather === "heavy_rain" ? 1 : 0,
        weather_fog: formData.weather === "fog" ? 1 : 0,
        num_horses: parseInt(formData.numHorses),
      };

      const result = await predictMutation.mutateAsync({
        features,
        raceId: formData.raceId || `race_${Date.now()}`,
        horseNames: validNames,
      });

      setPredictions(result);
      if (onPredictionsReceived) {
        onPredictionsReceived(result);
      }

      // Save each prediction to history if user is authenticated
      if (isAuthenticated && result.predictions && result.predictions.length > 0) {
        result.predictions.forEach((pred: any) => {
          savePredictionMutation.mutate({
            raceId: formData.raceId || `race_${Date.now()}`,
            raceName: `${formData.trackType} - ${formData.distance}m`,
            raceDate: new Date(),
            horseName: pred.horseName,
            predictedRank: pred.rank,
            predictedScore: pred.score.toFixed(2),
            confidenceScore: pred.score.toFixed(2),
            features,
          });
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Race Details Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Race Details</CardTitle>
          <CardDescription className="text-slate-400">
            Select race parameters from the dropdowns below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Races */}
          <div>
            <Label className="text-slate-300 mb-2 block">Load Live Race</Label>
            {liveRacesQuery.data && liveRacesQuery.data.length > 0 && (
              <select
                onChange={(e) => {
                  const race = liveRacesQuery.data?.find((r: any) => r.id === e.target.value);
                  if (race) {
                    const numHorses = race.horses.length;
                    setFormData({
                      raceId: race.id,
                      trackType: race.track,
                      distance: race.distance,
                      raceClass: race.raceClass,
                      weather: race.weather || "clear",
                      numHorses: numHorses.toString(),
                      horseNames: race.horses.map((h: any) => h.name),
                    });
                    setPredictions(null);
                    setError("");
                  }
                }}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 mb-3"
              >
                <option value="">Select Live Race...</option>
                {liveRacesQuery.data.map((race: any) => (
                  <option key={race.id} value={race.id}>
                    {race.name} - {race.horses.length} horses
                  </option>
                ))}
              </select>
            )}
            {liveRacesQuery.isLoading && (
              <p className="text-slate-400 text-sm mb-3">Loading live races...</p>
            )}
          </div>

          {/* Sample Races */}
          <div>
            <Label className="text-slate-300 mb-2 block">Or Load Sample Race</Label>
            <div className="flex gap-2">
              <Button
                onClick={loadRandomRace}
                variant="outline"
                className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                disabled={randomRaceQuery.isLoading}
              >
                {randomRaceQuery.isLoading ? "Loading..." : "Random Race"}
              </Button>
              {mockRacesQuery.data && mockRacesQuery.data.length > 0 && (
                <select
                  onChange={(e) => {
                    const race = mockRacesQuery.data?.find((r: any) => r.id === e.target.value);
                    if (race) loadSampleRace(race);
                  }}
                  className="flex-1 bg-slate-700 border border-slate-600 text-white rounded px-3 py-2"
                >
                  <option value="">Select Sample Race...</option>
                  {mockRacesQuery.data.map((race: any) => (
                    <option key={race.id} value={race.id}>
                      {race.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Race ID */}
          <div>
            <Label className="text-slate-300">Race ID</Label>
            <Input
              value={formData.raceId}
              onChange={(e) => setFormData({ ...formData, raceId: e.target.value })}
              placeholder="e.g., RACE_2025_01_15"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 mt-2"
            />
          </div>

          {/* Track Type */}
          <div>
            <Label className="text-slate-300 mb-2 block">Track Type</Label>
            <Select value={formData.trackType} onValueChange={(value) => setFormData({ ...formData, trackType: value })}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {trackTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-white">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Distance */}
          <div>
            <Label className="text-slate-300 mb-2 block">Race Distance</Label>
            <Select value={formData.distance} onValueChange={(value) => setFormData({ ...formData, distance: value })}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {distances.map((dist) => (
                  <SelectItem key={dist.value} value={dist.value} className="text-white">
                    {dist.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Race Class */}
          <div>
            <Label className="text-slate-300 mb-2 block">Race Class</Label>
            <Select value={formData.raceClass} onValueChange={(value) => setFormData({ ...formData, raceClass: value })}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {raceClasses.map((cls) => (
                  <SelectItem key={cls.value} value={cls.value} className="text-white">
                    {cls.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weather */}
          <div>
            <Label className="text-slate-300 mb-2 block">Weather</Label>
            <Select value={formData.weather} onValueChange={(value) => setFormData({ ...formData, weather: value })}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {weatherConditions.map((cond) => (
                  <SelectItem key={cond.value} value={cond.value} className="text-white">
                    {cond.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Number of Horses */}
          <div>
            <Label className="text-slate-300 mb-2 block">Number of Horses</Label>
            <Select value={formData.numHorses} onValueChange={handleNumHorsesChange}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {horseCountOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-white">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horse Names */}
          <div>
            <Label className="text-slate-300 mb-2 block">Horse Names</Label>
            <div className="grid grid-cols-2 gap-3">
              {formData.horseNames.map((name, idx) => (
                <Input
                  key={idx}
                  value={name}
                  onChange={(e) => handleHorseNameChange(idx, e.target.value)}
                  placeholder={`Horse ${idx + 1}`}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
        disabled={loading || predictMutation.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
      >
        {(loading || predictMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Get Race Predictions
      </Button>

      {/* Predictions Display */}
      {predictions && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Race Predictions</CardTitle>
            <CardDescription className="text-slate-400">
              Ranked predictions for race {predictions.raceId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions.predictions.map((pred: any, idx: number) => {
                // Determine confidence color and label based on score
                let confidenceColor = "bg-red-500";
                let confidenceLabel = "Low Confidence";
                if (pred.score >= 70) {
                  confidenceColor = "bg-green-500";
                  confidenceLabel = "High Confidence";
                } else if (pred.score >= 50) {
                  confidenceColor = "bg-yellow-500";
                  confidenceLabel = "Medium Confidence";
                }

                return (
                  <div key={idx} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold text-lg">
                          #{pred.rank} {pred.horseName}
                        </p>
                        <p className="text-slate-400 text-sm">{confidenceLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-400 font-mono text-2xl">{pred.score.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${confidenceColor} transition-all duration-300`}
                        style={{ width: `${Math.min(pred.score, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mt-4">
                <p className="text-blue-300 text-sm">
                  Ensemble Confidence: <span className="font-semibold">{predictions.ensembleScore.toFixed(1)}%</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
