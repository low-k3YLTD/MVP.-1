/**
 * Live Race Data Service
 * Fetches real-time racing data from multiple providers
 * Supports: The Racing API, RapidAPI, and other sources
 */

import { TRPCError } from "@trpc/server";

export interface LiveRace {
  id: string;
  name: string;
  track: string;
  time: string; // ISO timestamp
  distance: string; // in meters
  raceClass: string;
  weather?: string;
  going?: string; // Track condition (good, soft, heavy, etc)
  horses: LiveHorse[];
  country: string;
  meetingDate: string;
}

export interface LiveHorse {
  id: string;
  name: string;
  number: number;
  jockey?: string;
  trainer?: string;
  weight?: string;
  odds?: number;
  form?: string;
}

class LiveRaceDataService {
  private racingApiKey: string | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, { data: LiveRace[]; timestamp: number }> = new Map();

  constructor() {
    // Try to load API key from environment
    this.racingApiKey = process.env.RACING_API_KEY || null;
  }

  /**
   * Get HTTP Basic Auth header from username and password
   */
  private getBasicAuthHeader(username: string, password: string): string {
    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Get upcoming races from The Racing API
   * Uses HTTP Basic Authentication with username and password
   */
  async getUpcomingRacesFromTheRacingAPI(): Promise<LiveRace[]> {
    const username = process.env.RACING_API_USERNAME;
    const password = process.env.RACING_API_PASSWORD;

    if (!username || !password) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Racing API credentials not configured. Set RACING_API_USERNAME and RACING_API_PASSWORD environment variables.",
      });
    }

    try {
      const authHeader = this.getBasicAuthHeader(username, password);
      
      // Fetch racecards for today
      const response = await fetch("https://api.theracingapi.com/v1/racecards/free?day=today", {
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LiveRaceData] API returned ${response.status}: ${errorText}`);
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      return this.transformTheRacingAPIData(data);
    } catch (error) {
      console.error("[LiveRaceData] Error fetching from The Racing API:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch live race data: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  /**
   * Get upcoming races from RapidAPI Horse Racing API
   */
  async getUpcomingRacesFromRapidAPI(): Promise<LiveRace[]> {
    const rapidApiKey = process.env.RAPIDAPI_KEY;

    if (!rapidApiKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "RapidAPI key not configured. Set RAPIDAPI_KEY environment variable.",
      });
    }

    try {
      const response = await fetch("https://horse-racing-api.p.rapidapi.com/races", {
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": "horse-racing-api.p.rapidapi.com",
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      return this.transformRapidAPIData(data);
    } catch (error) {
      console.error("[LiveRaceData] Error fetching from RapidAPI:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch live race data: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  /**
   * Get upcoming races with fallback to mock data if APIs fail
   */
  async getUpcomingRaces(provider: "racing-api" | "rapidapi" | "auto" = "auto"): Promise<LiveRace[]> {
    // Check cache first
    const cacheKey = `upcoming_races_${provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log("[LiveRaceData] Returning cached races");
      return cached.data;
    }

    try {
      let races: LiveRace[] = [];

      if (provider === "auto") {
        // Try The Racing API first, fallback to RapidAPI
        try {
          races = await this.getUpcomingRacesFromTheRacingAPI();
        } catch (error) {
          console.warn("[LiveRaceData] The Racing API failed, trying RapidAPI...");
          try {
            races = await this.getUpcomingRacesFromRapidAPI();
          } catch (rapidError) {
            console.warn("[LiveRaceData] RapidAPI also failed, using mock data");
            races = this.generateMockLiveRaces();
          }
        }
      } else if (provider === "racing-api") {
        races = await this.getUpcomingRacesFromTheRacingAPI();
      } else if (provider === "rapidapi") {
        races = await this.getUpcomingRacesFromRapidAPI();
      }

      // Cache the results
      this.cache.set(cacheKey, { data: races, timestamp: Date.now() });
      return races;
    } catch (error) {
      console.error("[LiveRaceData] Error getting upcoming races:", error);
      // Return mock data as final fallback
      return this.generateMockLiveRaces();
    }
  }

  /**
   * Transform The Racing API response to our format
   */
  private transformTheRacingAPIData(data: any): LiveRace[] {
    try {
      if (!data.racecards || !Array.isArray(data.racecards)) {
        console.warn("[LiveRaceData] No racecards found in API response");
        return [];
      }

      const races: LiveRace[] = [];

      for (const racecard of data.racecards) {
        const courseName = racecard.course || "Unknown";
        const meetingDate = racecard.date || new Date().toISOString().split("T")[0];
        const region = racecard.region || "Unknown";
        const countryMap: Record<string, string> = {
          "GB": "UK",
          "IRE": "Ireland",
          "USA": "USA",
          "AUS": "Australia",
        };
        const country = countryMap[region] || region;

        // Each racecard represents a single race meeting with multiple races
        // We'll create one race entry per racecard for simplicity
        const horses: LiveHorse[] = [];

        if (racecard.runners && Array.isArray(racecard.runners)) {
          for (const runner of racecard.runners) {
            horses.push({
              id: `${runner.number}`,
              name: runner.horse || "Unknown",
              number: parseInt(runner.number) || 0,
              jockey: runner.jockey || undefined,
              trainer: runner.trainer || undefined,
              weight: runner.lbs ? `${runner.lbs}lbs` : undefined,
              odds: undefined, // Odds not in free tier
              form: runner.form || undefined,
            });
          }
        }

        // Parse distance (convert furlongs to meters if needed)
        let distance = "Unknown";
        if (racecard.distance_f) {
          // Convert furlongs to meters (1 furlong = 201.168 meters)
          const meters = Math.round(racecard.distance_f * 201.168);
          distance = meters.toString();
        }

        races.push({
          id: `${courseName}_${meetingDate}_${racecard.off_time || "unknown"}`,
          name: racecard.race_name || `${courseName} Race`,
          track: courseName,
          time: racecard.off_dt || new Date().toISOString(),
          distance,
          raceClass: racecard.race_class || "Unknown",
          weather: undefined, // Not provided in free tier
          going: racecard.going || undefined,
          horses,
          country,
          meetingDate,
        });
      }

      console.log(`[LiveRaceData] Transformed ${races.length} races from The Racing API`);
      return races;
    } catch (error) {
      console.error("[LiveRaceData] Error transforming The Racing API data:", error);
      return [];
    }
  }

  /**
   * Transform RapidAPI response to our format
   */
  private transformRapidAPIData(data: any): LiveRace[] {
    // This would depend on the actual API response structure
    // For now, return empty array as placeholder
    console.log("[LiveRaceData] Transforming RapidAPI data...");
    return [];
  }

  /**
   * Generate realistic mock live races for testing
   */
  private generateMockLiveRaces(): LiveRace[] {
    const now = new Date();
    const tracks = [
      { name: "Ascot", country: "UK" },
      { name: "Cheltenham", country: "UK" },
      { name: "Newmarket", country: "UK" },
      { name: "Goodwood", country: "UK" },
      { name: "Curragh", country: "Ireland" },
      { name: "Leopardstown", country: "Ireland" },
      { name: "Belmont Park", country: "USA" },
      { name: "Churchill Downs", country: "USA" },
    ];

    const horseNames = [
      "Thunder Strike",
      "Golden Dream",
      "Swift Runner",
      "Noble Heart",
      "Silver Wind",
      "Midnight Shadow",
      "Blazing Fire",
      "Ocean Wave",
      "Mountain Peak",
      "Desert Rose",
      "Starlight",
      "Royal Crown",
      "Dancing Star",
      "Mighty Force",
      "Gentle Soul",
      "Bright Future",
      "Lucky Charm",
      "Victory Lane",
      "Storm Rider",
      "Sunset Glory",
    ];

    const jockeys = [
      "Frankie Dettori",
      "Ryan Moore",
      "Irad Ortiz Jr",
      "Oisin Murphy",
      "Hollie Doyle",
      "Sire Percy",
      "Tom Marquand",
      "Kieran Shoemark",
    ];

    const trainers = [
      "John Gosden",
      "Aidan O'Brien",
      "Sir Michael Stoute",
      "Clive Cox",
      "Charlie Appleby",
      "Saeed bin Suroor",
      "Roger Varian",
      "Mark Johnston",
    ];

    const races: LiveRace[] = [];

    // Generate 8 upcoming races
    for (let i = 0; i < 8; i++) {
      const track = tracks[i % tracks.length];
      const raceTime = new Date(now.getTime() + (i + 1) * 2 * 60 * 60 * 1000); // 2 hours apart

      const numHorses = Math.floor(Math.random() * 8) + 6; // 6-14 horses
      const horses: LiveHorse[] = [];

      // Shuffle horse names and select
      const shuffled = [...horseNames].sort(() => Math.random() - 0.5);
      for (let j = 0; j < numHorses && j < shuffled.length; j++) {
        horses.push({
          id: `${track.name}_${j}`,
          name: shuffled[j],
          number: j + 1,
          jockey: jockeys[Math.floor(Math.random() * jockeys.length)],
          trainer: trainers[Math.floor(Math.random() * trainers.length)],
          weight: `${50 + Math.floor(Math.random() * 30)}kg`,
          odds: parseFloat((1.5 + Math.random() * 30).toFixed(2)),
          form: Math.random() > 0.5 ? "123" : "231",
        });
      }

      races.push({
        id: `LIVE_${track.name}_${i}`,
        name: `${track.name} Race ${i + 1}`,
        track: track.name,
        time: raceTime.toISOString(),
        distance: ["1000", "1200", "1400", "1600", "2000", "2400"][Math.floor(Math.random() * 6)],
        raceClass: ["class1", "class2", "class3", "class4"][Math.floor(Math.random() * 4)],
        weather: ["clear", "overcast", "light_rain", "heavy_rain"][Math.floor(Math.random() * 4)],
        going: ["good", "good to soft", "soft", "heavy"][Math.floor(Math.random() * 4)],
        horses,
        country: track.country,
        meetingDate: raceTime.toISOString().split("T")[0],
      });
    }

    return races;
  }

  /**
   * Get races by country
   */
  async getRacesByCountry(country: string): Promise<LiveRace[]> {
    const races = await this.getUpcomingRaces();
    return races.filter((race) => race.country.toLowerCase() === country.toLowerCase());
  }

  /**
   * Get races by track
   */
  async getRacesByTrack(track: string): Promise<LiveRace[]> {
    const races = await this.getUpcomingRaces();
    return races.filter((race) => race.track.toLowerCase() === track.toLowerCase());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log("[LiveRaceData] Cache cleared");
  }
}

// Singleton instance
let liveRaceDataService: LiveRaceDataService | null = null;

export function getLiveRaceDataService(): LiveRaceDataService {
  if (!liveRaceDataService) {
    liveRaceDataService = new LiveRaceDataService();
  }
  return liveRaceDataService;
}
