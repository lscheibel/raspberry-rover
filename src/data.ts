import { SlidingBuffer } from './utils/SlidingBuffer.js';
import { ParsedGpsDataType } from './main.js';

interface GPSData {
  time: Date;
  nmeaType: ParsedGpsDataType;
  lat: number;
  lon: number;
}

export const store = {
  position: new SlidingBuffer<GPSData>(100),
  heading: new SlidingBuffer<number>(100),
};
