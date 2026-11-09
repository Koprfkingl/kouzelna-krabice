// Shared game state: what several modules read and change.
import { store } from './util.js';

export const S = {
  current: null,        // what is on stage or in the box
  second: null,         // a second thing in the box, mixed with the first by the laser
  busy: false,          // an animation runs, buttons wait
  phase: 'stage',       // which step of the game the panel shows
  shot: 'stage',        // camera view
  tapHook: null,        // care mode listens to taps and strokes on the monster
  album: store.get('kk-album', []),
  photos: store.get('kk-fotky', []),
  stars: store.get('kk-hvezdy', 0),
  roomPan: 0,           // room camera: -1 left … 1 right
  schovka: null,        // hide and seek in progress
  boost: false,         // the next laser shot is a golden Laser Boost
};
