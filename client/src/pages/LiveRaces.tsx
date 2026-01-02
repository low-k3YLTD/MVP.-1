import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Loader2, MapPin, Clock, Users } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function LiveRaces() {
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const { user } = useAuth();

  const liveRacesQuery = trpc.prediction.getUpcomingRaces.useQuery(
    { provider: "auto" },
    { refetchInterval: 30000 }
  );

  const predictLiveRaceMutation = trpc.prediction.predictLiveRace.useMutation();

  const handleRaceSelect = async (race: any) => {
    setSelectedRace(race);
    if (race.horses && race.horses.length > 0) {
      try {
        const predictions = await predictLiveRaceMutation.mutateAsync({
          raceId: race.id,
          horses: race.horses.map((h: any) => ({
            id: h.id || h.name,
            name: h.name,
            number: h.number,
            jockey: h.jockey,
            trainer: h.trainer,
            weight: h.weight,
          })),
        });
        setSelectedRace((prev: any) => ({ ...prev, predictions: predictions.horses, ensembleScore: predictions.ensembleScore }));
      } catch (error) {
        console.error('Failed to get predictions:', error);
      }
    }
  };

  const races = liveRacesQuery.data || [];
  const filteredRaces =
    filterCountry === "all" ? races : races.filter((race) => race.country === filterCountry);

  const countries = Array.from(new Set(races.map((r) => r.country))).sort();

  const formatTime = (isoTime: string) => {
    const date = new Date(isoTime);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getWeatherIcon = (weather: string) => {
    const icons: Record<string, string> = {
      clear: "☀️",
      overcast: "☁️",
      light_rain: "🌧️",
      heavy_rain: "⛈️",
      fog: "🌫️",
    };
    return icons[weather] || "🌤️";
  };

  const getGoingColor = (going: string) => {
    const colors: Record<string, string> = {
      good: "bg-green-900 text-green-200",
      "good to soft": "bg-yellow-900 text-yellow-200",
      soft: "bg-orange-900 text-orange-200",
      heavy: "bg-red-900 text-red-200",
    };
    return colors[going] || "bg-slate-700 text-slate-200";
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
          <h1 className="text-xl font-bold text-white">Live Races</h1>
          <Button
            onClick={() => liveRacesQuery.refetch()}
            disabled={liveRacesQuery.isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {liveRacesQuery.isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </div>
      </nav>

      <section className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Filter by Country</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setFilterCountry("all")}
              variant={filterCountry === "all" ? "default" : "outline"}
              className={
                filterCountry === "all"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              }
            >
              All Countries
            </Button>
            {countries.map((country) => (
              <Button
                key={country}
                onClick={() => setFilterCountry(country)}
                variant={filterCountry === country ? "default" : "outline"}
                className={
                  filterCountry === country
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                }
              >
                {country}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {liveRacesQuery.isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-blue-500 mr-2" size={32} />
            <span className="text-white">Loading live races...</span>
          </div>
        )}

        {/* Error State */}
        {liveRacesQuery.error && (
          <Card className="bg-red-900/20 border-red-700 mb-8">
            <CardContent className="pt-6">
              <p className="text-red-200">
                Error loading live races: {liveRacesQuery.error.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Races Grid */}
        {!liveRacesQuery.isLoading && filteredRaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filteredRaces.map((race) => (
              <Card
                key={race.id}
                className={`bg-slate-800 border-slate-700 cursor-pointer transition-all hover:border-blue-500 ${
                  selectedRace?.id === race.id ? "border-blue-500 ring-2 ring-blue-500" : ""
                }`}
                onClick={() => handleRaceSelect(race)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">{race.name}</CardTitle>
                      <CardDescription className="text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin size={14} />
                        {race.track}, {race.country}
                      </CardDescription>
                    </div>
                    <Badge className="bg-blue-600 text-white">{race.raceClass}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Race Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-400">Time</p>
                      <p className="text-white font-semibold flex items-center gap-1">
                        <Clock size={14} />
                        {formatTime(race.time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Distance</p>
                      <p className="text-white font-semibold">{race.distance}m</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Horses</p>
                      <p className="text-white font-semibold flex items-center gap-1">
                        <Users size={14} />
                        {race.horses.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Weather</p>
                      <p className="text-white font-semibold">{getWeatherIcon(race.weather || "clear")} {race.weather || "clear"}</p>
                    </div>
                  </div>

                  {/* Going */}
                  {race.going && (
                    <Badge className={`w-full justify-center ${getGoingColor(race.going)}`}>
                      Going: {race.going}
                    </Badge>
                  )}

                  {/* Horse Count */}
                  <div className="text-xs text-slate-400">
                    {race.horses.length} horses entered
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* No Races */}
        {!liveRacesQuery.isLoading && filteredRaces.length === 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6 text-center">
              <p className="text-slate-300">No races found for the selected filter.</p>
            </CardContent>
          </Card>
        )}

        {/* Selected Race Details */}
        {selectedRace && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">{selectedRace.name} - Horses</CardTitle>
              <CardDescription className="text-slate-400">
                {formatDate(selectedRace.time)} at {formatTime(selectedRace.time)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-2 text-slate-300">#</th>
                      <th className="text-left py-2 px-2 text-slate-300">Horse</th>
                      <th className="text-left py-2 px-2 text-slate-300">Jockey</th>
                      <th className="text-left py-2 px-2 text-slate-300">Trainer</th>
                      <th className="text-left py-2 px-2 text-slate-300">Weight</th>
                      <th className="text-left py-2 px-2 text-slate-300">{selectedRace.predictions ? 'Win Chance' : 'Odds'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRace.predictions || selectedRace.horses).map((horse: any, idx: number) => {
                      const score = horse.score || 0;
                      const scorePercent = Math.round(score * 100);
                      return (
                        <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                          <td className="py-2 px-2 text-white font-semibold">{horse.number}</td>
                          <td className="py-2 px-2 text-white">{horse.name}</td>
                          <td className="py-2 px-2 text-slate-300">{horse.jockey || "-"}</td>
                          <td className="py-2 px-2 text-slate-300">{horse.trainer || "-"}</td>
                          <td className="py-2 px-2 text-slate-300">{horse.weight || "-"}</td>
                          <td className="py-2 px-2">
                            {selectedRace.predictions ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="w-full bg-slate-700 rounded h-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded" style={{width: scorePercent + "%"}} />
                                  </div>
                                </div>
                                <span className="text-white font-semibold text-sm min-w-12 text-right">{scorePercent}%</span>
                              </div>
                            ) : (
                              <span className="text-white font-semibold">{horse.odds ? horse.odds : "-"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Predictions Info */}
              {selectedRace.predictions && (
                <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded">
                  <p className="text-blue-200 text-sm">
                    <strong>Ensemble Score:</strong> {selectedRace.ensembleScore ? (Math.round(selectedRace.ensembleScore * 100) / 100).toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-blue-200 text-sm mt-2">
                    Horses are ranked by prediction confidence. Higher percentages indicate stronger winning chances according to the ensemble model.
                  </p>
                </div>
              )}

              {/* Predict Button */}
              {!selectedRace.predictions && (
                <Link href="/predict">
                  <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white">
                    Get Manual Predictions for This Race
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
