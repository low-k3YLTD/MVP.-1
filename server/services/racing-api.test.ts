import { describe, it, expect, beforeAll } from 'vitest';

describe('Racing API Integration', () => {
  let username: string;
  let password: string;

  beforeAll(() => {
    username = process.env.RACING_API_USERNAME || '';
    password = process.env.RACING_API_PASSWORD || '';
  });

  it('should have Racing API credentials configured', () => {
    expect(username).toBeTruthy();
    expect(password).toBeTruthy();
  });

  it('should authenticate with The Racing API using Basic Auth', async () => {
    if (!username || !password) {
      throw new Error('Racing API credentials not configured');
    }

    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    const authHeader = `Basic ${encoded}`;

    const response = await fetch('https://api.theracingapi.com/v1/racecards/free?day=today', {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.racecards).toBeDefined();
  });

  it('should return racecard data with proper structure', async () => {
    if (!username || !password) {
      throw new Error('Racing API credentials not configured');
    }

    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    const authHeader = `Basic ${encoded}`;

    const response = await fetch('https://api.theracingapi.com/v1/racecards/free?day=today', {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    
    if (data.racecards && data.racecards.length > 0) {
      const racecard = data.racecards[0];
      expect(racecard.course).toBeDefined();
      expect(racecard.date).toBeDefined();
      expect(racecard.off_time).toBeDefined();
      expect(racecard.distance_f).toBeDefined();
      
      if (racecard.runners && racecard.runners.length > 0) {
        const runner = racecard.runners[0];
        expect(runner.horse).toBeDefined();
        expect(runner.number).toBeDefined();
        expect(runner.jockey).toBeDefined();
        expect(runner.trainer).toBeDefined();
      }
    }
  });
});
