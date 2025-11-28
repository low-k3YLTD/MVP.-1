import { describe, it, expect, beforeAll } from 'vitest';
import { getLiveRaceDataService } from './liveRaceDataService';

describe('Live Races Integration', () => {
  let service: ReturnType<typeof getLiveRaceDataService>;

  beforeAll(() => {
    service = getLiveRaceDataService();
  });

  it('should fetch upcoming races from The Racing API', async () => {
    const races = await service.getUpcomingRaces('racing-api');
    
    expect(races).toBeDefined();
    expect(Array.isArray(races)).toBe(true);
    expect(races.length).toBeGreaterThan(0);
  });

  it('should have proper race structure', async () => {
    const races = await service.getUpcomingRaces('racing-api');
    
    if (races.length > 0) {
      const race = races[0];
      
      expect(race.id).toBeDefined();
      expect(race.name).toBeDefined();
      expect(race.track).toBeDefined();
      expect(race.time).toBeDefined();
      expect(race.distance).toBeDefined();
      expect(race.raceClass).toBeDefined();
      expect(race.country).toBeDefined();
      expect(race.meetingDate).toBeDefined();
      expect(Array.isArray(race.horses)).toBe(true);
    }
  });

  it('should have horses with required fields', async () => {
    const races = await service.getUpcomingRaces('racing-api');
    
    if (races.length > 0 && races[0].horses.length > 0) {
      const horse = races[0].horses[0];
      
      expect(horse.id).toBeDefined();
      expect(horse.name).toBeDefined();
      expect(horse.number).toBeDefined();
    }
  });

  it('should filter races by country', async () => {
    const ukRaces = await service.getRacesByCountry('UK');
    
    expect(Array.isArray(ukRaces)).toBe(true);
    
    if (ukRaces.length > 0) {
      ukRaces.forEach(race => {
        expect(race.country).toBe('UK');
      });
    }
  });

  it('should filter races by track', async () => {
    const races = await service.getUpcomingRaces('racing-api');
    
    if (races.length > 0) {
      const trackName = races[0].track;
      const trackRaces = await service.getRacesByTrack(trackName);
      
      expect(Array.isArray(trackRaces)).toBe(true);
      
      trackRaces.forEach(race => {
        expect(race.track).toBe(trackName);
      });
    }
  });
});
