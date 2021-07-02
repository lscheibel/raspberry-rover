import { mapEngineValues } from './index.js';

export const getEngnieSpeedByDistance = (distance: number, velocity: number) => {
  return mapEngineValues(Math.tanh(distance - velocity * (velocity / 2)));
};
