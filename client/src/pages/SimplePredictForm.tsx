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
  const mockRacesQuery = trpc.prediction.getMockRaces.useQuery();
  const randomRaceQuery = trpc.prediction.getRandomRace.useQuery();

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
          {/* Sample Races */}
          <div>
            <Label className="text-slate-300 mb-2 block">Load Sample Race</Label>
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
            <Label className="text-slate-300 mb-2 block">Weather Condition</Label>
            <Select value={formData.weather} onValueChange={(value) => setFormData({ ...formData, weather: value })}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {weatherConditions.map((weather) => (
                  <SelectItem key={weather.value} value={weather.value} className="text-white">
                    {weather.label}
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
                {horseCountOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-white">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Horse Names Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Horse Names</CardTitle>
          <CardDescription className="text-slate-400">
            Enter the names of {formData.numHorses} horses competing in this race
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {formData.horseNames.map((name, index) => (
              <div key={index}>
                <Label className="text-slate-300 text-sm mb-2 block">Horse {index + 1}</Label>
                <Input
                  value={name}
                  onChange={(e) => handleHorseNameChange(index, e.target.value)}
                  placeholder={`Enter horse name`}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            ))}
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
              {predictions.predictions.map((pred: any, idx: number) => (
                <div key={idx} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-lg">
                        #{pred.rank} {pred.horseName}
                      </p>
                      <p className="text-slate-400 text-sm">Confidence Score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-400 font-mono text-2xl">{pred.score.toFixed(2)}</p>
                      <div className="w-24 h-2 bg-slate-600 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min((pred.score / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mt-4">
                <p className="text-green-300 text-sm">
                  Ensemble Score: <span className="font-semibold">{predictions.ensembleScore.toFixed(2)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
