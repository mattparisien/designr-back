import { createExecutors } from './agent/executors/index.js';

async function runNormalizeTest() {
  const executors = createExecutors({});
  const sampleResults = [
    { title: 'Bike Riding Tips', snippet: 'Always wear a helmet', url: 'https://example.com/bike' },
    { title: 'Summer Biking', snippet: 'Stay hydrated', url: 'https://example.com/summer' }
  ];

  try {
    const normalized = await executors.normalize_search_results({
      results: sampleResults,
      designIntent: 'summer biking tips'
    });
    console.log(JSON.stringify(normalized, null, 2));
  } catch (error) {
    console.error('Normalization debug failed:', error.message);
  }
}

runNormalizeTest();
