import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, TrendingUp, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface BetCard {
  betType: "exacta" | "trifecta" | "superfecta";
  combination: number[];
  combinationNames: string[];
  probability: number;
  payoutOdds: number;
  expectedValue: number;
  kellyFraction: number;
  confidenceScore: number;
}

export default function ExoticBets() {
  const [, setLocation] = useLocation();
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"ev" | "probability" | "kelly">("ev");
  const [betTypeFilter, setBetTypeFilter] = useState<"all" | "exacta" | "trifecta" | "superfecta">("all");

  // Fetch live races
  const { data: racesData, isLoading: racesLoading } = trpc.prediction.getUpcomingRaces.useQuery();

  // Optimize race for exotic bets
  const optimizeRaceMutation = trpc.exoticBets.optimizeRace.useMutation();
  
  // Get predictions for race horses
  const getPredictionsMutation = trpc.prediction.getRaceHorsePredictions.useMutation();

  const races = useMemo(() => {
    if (!racesData) return [];
    return Array.isArray(racesData) ? racesData : [];
  }, [racesData]);

  // Handle race selection
  const handleRaceSelect = async (race: any) => {
    setSelectedRaceId(race.id);
    setSelectedRace(race);

    // Fetch predictions for the horses
    getPredictionsMutation.mutate({
      raceId: race.id,
      horses: (race.horses || []).map((horse: any, idx: number) => ({
        id: idx + 1,
        name: horse.name || `Horse ${idx + 1}`,
        weight: horse.weight,
        jockey: horse.jockey,
        trainer: horse.trainer,
      })),
    });
  };

  // When predictions are ready, optimize the race
  useMemo(() => {
    if (getPredictionsMutation.data && selectedRace) {
      const horsesForOptimization = getPredictionsMutation.data.horses.map((horse: any) => ({
        id: horse.id,
        name: horse.name,
        winProbability: horse.winProbability,
        odds: parseFloat(selectedRace.horses?.[horse.id - 1]?.odds) || 5.0,
        formRating: 70 + Math.random() * 30,
        speedRating: 70 + Math.random() * 30,
        classRating: 70 + Math.random() * 30,
      }));

      optimizeRaceMutation.mutate({
        raceId: selectedRace.id,
        horses: horsesForOptimization,
      });
    }
  }, [getPredictionsMutation.data, selectedRace]);


  // Filter and sort bets
  const filteredAndSortedBets = useMemo(() => {
    if (!optimizeRaceMutation.data) return [];

    let bets: BetCard[] = [];

    if (betTypeFilter === "all" || betTypeFilter === "exacta") {
      bets = [...bets, ...optimizeRaceMutation.data.exactaBets];
    }
    if (betTypeFilter === "all" || betTypeFilter === "trifecta") {
      bets = [...bets, ...optimizeRaceMutation.data.trifectaBets];
    }
    if (betTypeFilter === "all" || betTypeFilter === "superfecta") {
      bets = [...bets, ...optimizeRaceMutation.data.superfectaBets];
    }

    return bets.sort((a, b) => {
      switch (sortBy) {
        case "ev":
          return b.expectedValue - a.expectedValue;
        case "probability":
          return b.probability - a.probability;
        case "kelly":
          return b.kellyFraction - a.kellyFraction;
        default:
          return 0;
      }
    });
  }, [optimizeRaceMutation.data, betTypeFilter, sortBy]);

  const getBetTypeColor = (betType: string) => {
    switch (betType) {
      case "exacta":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "trifecta":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "superfecta":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getEVColor = (ev: number) => {
    if (ev > 0.5) return "text-green-600 dark:text-green-400";
    if (ev > 0) return "text-green-500 dark:text-green-300";
    if (ev > -0.2) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-4xl font-bold text-white mb-2">Exotic Bets Optimizer</h1>
          <p className="text-slate-400">
            Select a live race to generate optimal exacta, trifecta, and superfecta combinations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Race Selection Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sticky top-4">
              <h2 className="text-lg font-semibold text-white mb-4">Live Races</h2>

              {racesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : races.length === 0 ? (
                <p className="text-slate-400 text-sm">No live races available</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {races.map((race: any) => (
                    <button
                      key={race.id}
                      onClick={() => handleRaceSelect(race)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedRaceId === race.id
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      <div className="font-medium text-sm">{race.track || race.trackName}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {race.raceTime} • {race.horses?.length || 0} horses
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bets Display */}
          <div className="lg:col-span-3">
            {selectedRace ? (
              <div className="space-y-6">
                {/* Selected Race Info */}
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Track</p>
                      <p className="text-white font-semibold">{selectedRace.track || selectedRace.trackName}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Race Time</p>
                      <p className="text-white font-semibold">{selectedRace.raceTime}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Distance</p>
                      <p className="text-white font-semibold">{selectedRace.distance || selectedRace.raceDistance || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Horses</p>
                      <p className="text-white font-semibold">{selectedRace.horses?.length || 0}</p>
                    </div>
                  </div>
                </Card>

                {/* Filters and Sorting */}
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="text-slate-400 text-sm block mb-2">Bet Type</label>
                    <div className="flex gap-2">
                      {(["all", "exacta", "trifecta", "superfecta"] as const).map((type) => (
                        <Button
                          key={type}
                          variant={betTypeFilter === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => setBetTypeFilter(type)}
                          className="capitalize"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-sm block mb-2">Sort By</label>
                    <div className="flex gap-2">
                      {(["ev", "probability", "kelly"] as const).map((sort) => (
                        <Button
                          key={sort}
                          variant={sortBy === sort ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSortBy(sort)}
                          className="capitalize"
                        >
                          {sort}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Optimization Loading */}
                {optimizeRaceMutation.isPending ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                      <p className="text-slate-400">Optimizing exotic bets...</p>
                    </div>
                  </div>
                ) : optimizeRaceMutation.isError ? (
                  <Card className="bg-red-900/20 border-red-700 p-6">
                    <p className="text-red-400">Error optimizing race. Please try again.</p>
                  </Card>
                ) : optimizeRaceMutation.data ? (
                  <div>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Card className="bg-slate-800 border-slate-700 p-4">
                        <p className="text-slate-400 text-sm">Total Combinations</p>
                        <p className="text-2xl font-bold text-white">
                          {optimizeRaceMutation.data.totalCombinationsAnalyzed}
                        </p>
                      </Card>
                      <Card className="bg-slate-800 border-slate-700 p-4">
                        <p className="text-slate-400 text-sm">Profitable</p>
                        <p className="text-2xl font-bold text-green-400">
                          {optimizeRaceMutation.data.profitableOpportunities}
                        </p>
                      </Card>
                      <Card className="bg-slate-800 border-slate-700 p-4">
                        <p className="text-slate-400 text-sm">Profitability Rate</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {(optimizeRaceMutation.data.profitabilityRate * 100).toFixed(1)}%
                        </p>
                      </Card>
                      <Card className="bg-slate-800 border-slate-700 p-4">
                        <p className="text-slate-400 text-sm">Avg EV</p>
                        <p className={`text-2xl font-bold ${getEVColor(optimizeRaceMutation.data.averageExpectedValue)}`}>
                          {optimizeRaceMutation.data.averageExpectedValue.toFixed(2)}
                        </p>
                      </Card>
                    </div>

                    {/* Bet Cards */}
                    {filteredAndSortedBets.length === 0 ? (
                      <Card className="bg-slate-800 border-slate-700 p-8 text-center">
                        <p className="text-slate-400">No bets match the selected filters</p>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAndSortedBets.map((bet, idx) => (
                          <Card
                            key={`${bet.betType}-${idx}`}
                            className="bg-slate-800 border-slate-700 hover:border-slate-500 transition-all p-5"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <Badge className={getBetTypeColor(bet.betType)}>
                                  {bet.betType.toUpperCase()}
                                </Badge>
                                <p className="text-white font-semibold mt-2">
                                  {bet.combinationNames.join(" → ")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-bold ${getEVColor(bet.expectedValue)}`}>
                                  EV: {bet.expectedValue.toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-slate-400 text-xs">Probability</p>
                                <p className="text-white font-semibold">
                                  {(bet.probability * 100).toFixed(2)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-xs">Payout Odds</p>
                                <p className="text-white font-semibold">{bet.payoutOdds.toFixed(1)}x</p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-xs">Kelly Fraction</p>
                                <p className="text-white font-semibold">
                                  {(bet.kellyFraction * 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400 text-xs">Confidence</p>
                                <p className="text-white font-semibold">
                                  {(bet.confidenceScore * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>

                            {/* Progress bars */}
                            <div className="space-y-2 mb-4">
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-slate-400 text-xs">Probability</span>
                                  <span className="text-slate-400 text-xs">
                                    {(bet.probability * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(bet.probability * 100, 100)}%` }}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-slate-400 text-xs">Confidence</span>
                                  <span className="text-slate-400 text-xs">
                                    {(bet.confidenceScore * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2">
                                  <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(bet.confidenceScore * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Action Button */}
                            <Button className="w-full bg-blue-600 hover:bg-blue-700">
                              <Zap className="w-4 h-4 mr-2" />
                              Add to Bet Slip
                            </Button>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Card className="bg-slate-800 border-slate-700 p-8 text-center">
                    <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Select a race to generate exotic bet recommendations</p>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="bg-slate-800 border-slate-700 p-12 text-center">
                <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">Select a live race to get started</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
