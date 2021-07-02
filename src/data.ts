import { SlidingBuffer } from './utils/SlidingBuffer.js';
import { ParsedGpsDataNMEAType } from './main.js';
import Timeout = NodeJS.Timeout;
import { navigator } from './Autonomous.js';

interface GPSData {
  time: Date;
  nmeaType: ParsedGpsDataNMEAType;
  lat: number;
  lon: number;
}

export const store = {
  position: new SlidingBuffer<GPSData>(100),
  heading: new SlidingBuffer<number>(100),
  currentEngine: [0, 0],
  autonomous: null as Timeout | null,
  navigator: navigator,
};
