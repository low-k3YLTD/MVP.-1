import { describe, it, expect, beforeAll } from 'vitest';
import { getPredictionService } from './predictionService';
import { getLiveRaceDataService } from './liveRaceDataService';

describe('Predictions with Live Races', () => {
  let predictionService: ReturnType<typeof getPredictionService>;
  let liveRaceService: ReturnType<typeof getLiveRaceDataService>;

  beforeAll(() => {
    predictionService = getPredictionService();
    liveRaceService = getLiveRaceDataService();
  });

  it('should get model information', () => {
    const modelInfo = predictionService.getModelInfo();
    
    expect(modelInfo).toBeDefined();
    expect(modelInfo.models).toBeDefined();
    expect(Array.isArray(modelInfo.models)).toBe(true);
    expect(modelInfo.models.length).toBeGreaterThan(0);
  });

  it('should fetch live races and have valid structure', async () => {
    const races = await liveRaceService.getUpcomingRaces('racing-api');
    
    expect(races).toBeDefined();
    expect(Array.isArray(races)).toBe(true);
    expect(races.length).toBeGreaterThan(0);
    
    const race = races[0];
    expect(race.horses.length).toBeGreaterThan(0);
  });

  it('should make predictions for live race horses', async () => {
    const races = await liveRaceService.getUpcomingRaces('racing-api');
    
    if (races.length > 0 && races[0].horses.length > 0) {
      const race = races[0];
      const horse = race.horses[0];
      
      // Create mock features for prediction
      const features = {
        'horse_age': 4,
        'jockey_experience': 100,
        'trainer_wins': 50,
        'recent_form': 3,
        'distance_preference': 1200,
        'track_preference': 0.8,
        'weight': parseInt(horse.weight?.replace('lbs', '') || '140'),
      };
      
      const prediction = await predictionService.predictRace({
        features,
        raceId: race.id,
        horseNames: [horse.name],
      });
      
      expect(prediction).toBeDefined();
      expect(prediction.predictions).toBeDefined();
      expect(Array.isArray(prediction.predictions)).toBe(true);
      expect(prediction.predictions.length).toBeGreaterThan(0);
    }
  });

  it('should handle batch predictions for live race', async () => {
    const races = await liveRaceService.getUpcomingRaces('racing-api');
    
    if (races.length > 0 && races[0].horses.length >= 2) {
      const race = races[0];
      const batchInput = race.horses.slice(0, 3).map(horse => ({
        features: {
          'horse_age': 4,
          'jockey_experience': 100,
          'trainer_wins': 50,
          'recent_form': 3,
          'distance_preference': 1200,
          'track_preference': 0.8,
          'weight': parseInt(horse.weight?.replace('lbs', '') || '140'),
        },
        raceId: race.id,
      }));
      
      const batchPrediction = await predictionService.predictBatch(batchInput);
      
      expect(batchPrediction).toBeDefined();
      expect(Array.isArray(batchPrediction)).toBe(true);
      expect(batchPrediction.length).toBe(batchInput.length);
    }
  });

  it('should filter live races by country and make predictions', async () => {
    const ukRaces = await liveRaceService.getRacesByCountry('UK');
    
    if (ukRaces.length > 0 && ukRaces[0].horses.length > 0) {
      const race = ukRaces[0];
      expect(race.country).toBe('UK');
      
      const horse = race.horses[0];
      const features = {
        'horse_age': 4,
        'jockey_experience': 100,
        'trainer_wins': 50,
        'recent_form': 3,
        'distance_preference': parseInt(race.distance),
        'track_preference': 0.8,
        'weight': parseInt(horse.weight?.replace('lbs', '') || '140'),
      };
      
      const prediction = await predictionService.predictRace({
        features,
        raceId: race.id,
      });
      
      expect(prediction).toBeDefined();
      expect(prediction.predictions).toBeDefined();
    }
  });
});
