/**
 * Mock Race Data Service
 * Provides realistic sample races for testing the prediction system
 */

export interface MockRace {
  id: string;
  name: string;
  track: string;
  distance: string;
  raceClass: string;
  weather: string;
  horses: string[];
}

const sampleHorses = [
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
];

const mockRaces: MockRace[] = [
  {
    id: "RACE_2025_01_15_01",
    name: "The Classic Sprint",
    track: "turf",
    distance: "1200",
    raceClass: "class1",
    weather: "clear",
    horses: ["Thunder Strike", "Golden Dream", "Swift Runner", "Noble Heart", "Silver Wind", "Midnight Shadow", "Blazing Fire", "Ocean Wave"],
  },
  {
    id: "RACE_2025_01_15_02",
    name: "The Mile Championship",
    track: "dirt",
    distance: "1600",
    raceClass: "class2",
    weather: "overcast",
    horses: ["Mountain Peak", "Desert Rose", "Starlight", "Royal Crown", "Dancing Star", "Mighty Force", "Gentle Soul", "Thunder Strike"],
  },
  {
    id: "RACE_2025_01_15_03",
    name: "The Long Distance Challenge",
    track: "synthetic",
    distance: "2000",
    raceClass: "class3",
    weather: "light_rain",
    horses: ["Golden Dream", "Swift Runner", "Noble Heart", "Silver Wind", "Midnight Shadow", "Blazing Fire", "Ocean Wave", "Mountain Peak"],
  },
  {
    id: "RACE_2025_01_15_04",
    name: "The Maiden Stakes",
    track: "turf",
    distance: "1400",
    raceClass: "class4",
    weather: "clear",
    horses: ["Desert Rose", "Starlight", "Royal Crown", "Dancing Star", "Mighty Force", "Gentle Soul"],
  },
  {
    id: "RACE_2025_01_15_05",
    name: "The Grand Finale",
    track: "dirt",
    distance: "2400",
    raceClass: "class1",
    weather: "heavy_rain",
    horses: ["Thunder Strike", "Golden Dream", "Swift Runner", "Noble Heart", "Silver Wind", "Midnight Shadow", "Blazing Fire", "Ocean Wave", "Mountain Peak", "Desert Rose"],
  },
];

export function getMockRaces(): MockRace[] {
  return mockRaces;
}

export function getMockRaceById(id: string): MockRace | undefined {
  return mockRaces.find((race) => race.id === id);
}

export function getRandomMockRace(): MockRace {
  return mockRaces[Math.floor(Math.random() * mockRaces.length)];
}

export function generateRandomRace(): MockRace {
  const trackTypes = ["turf", "dirt", "synthetic"];
  const distances = ["1000", "1200", "1400", "1600", "2000", "2400"];
  const classes = ["class1", "class2", "class3", "class4"];
  const weathers = ["clear", "overcast", "light_rain", "heavy_rain", "fog"];

  const numHorses = Math.floor(Math.random() * 8) + 6; // 6-14 horses
  const selectedHorses: string[] = [];

  // Shuffle and select random horses
  const shuffled = [...sampleHorses].sort(() => Math.random() - 0.5);
  for (let i = 0; i < numHorses && i < shuffled.length; i++) {
    selectedHorses.push(shuffled[i]);
  }

  return {
    id: `RACE_${Date.now()}`,
    name: `Race ${Math.floor(Math.random() * 1000)}`,
    track: trackTypes[Math.floor(Math.random() * trackTypes.length)],
    distance: distances[Math.floor(Math.random() * distances.length)],
    raceClass: classes[Math.floor(Math.random() * classes.length)],
    weather: weathers[Math.floor(Math.random() * weathers.length)],
    horses: selectedHorses,
  };
}
