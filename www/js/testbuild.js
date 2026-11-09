// The test build (a separate app "Krabice TEST") switches this on: the CI rewrites TEST_BUILD before building it.
// In the browser, ?test does the same. No imports of game modules here, so anything can use it early.
import { params, store } from './util.js';

export const TEST_BUILD = false;
export const isTest = TEST_BUILD || params.has('test');
// the pretend date for the season (Advent), set in the test panel
export const testDate = () => (isTest ? store.get('kk-test-datum', null) : null);
