// CLI script to benchmark FreeAstrologyAPI + JyotishMath accuracy against AstroSage outputs
// Usage: npx tsx server/scripts/verifyAstroSage.ts

import 'dotenv/config';
import { compileBirthChart } from '../services/chartCompiler';

const SAMPLE_CHARTS = [
  {
    name: 'Sample Chart 1 (Mumbai)',
    birthDate: '1992-07-15',
    birthTime: '09:30:00',
    birthCity: 'Mumbai',
    birthState: 'Maharashtra',
    birthCountry: 'India',
  },
  {
    name: 'Sample Chart 2 (New Delhi)',
    birthDate: '1988-11-24',
    birthTime: '18:45:00',
    birthCity: 'New Delhi',
    birthState: 'Delhi',
    birthCountry: 'India',
  },
  {
    name: 'Sample Chart 3 (New York DST Check)',
    birthDate: '1995-06-10',
    birthTime: '14:15:00',
    birthCity: 'New York',
    birthState: 'New York',
    birthCountry: 'United States',
  },
];

async function run() {
  if (!process.env.FREE_ASTROLOGY_API_KEY) {
    console.error('Error: FREE_ASTROLOGY_API_KEY missing in environment.');
    process.exit(1);
  }

  for (const sample of SAMPLE_CHARTS) {
    console.log('\n============================================================');
    console.log(`VERIFYING: ${sample.name}`);
    try {
      const { chartTextContext } = await compileBirthChart(sample);
      console.log(chartTextContext);
    } catch (err) {
      console.error(`Failed for ${sample.name}:`, err);
    }
  }
}

run();
