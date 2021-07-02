import SerialPort from 'serialport';
import GPS, { GGA, GLL, GSA, GST, GSV, HDT, RMC, VTG, ZDA } from 'gps';
import { store } from './data.js';
import { httpServer } from './server/server.js';
import { Gpio } from 'pigpio';
import HMC5883L from 'compass-hmc5883l';
import onDeath from 'death';
import { clamp } from './utils/index.js';

// Compass

const COMPASS_BUS_NUMBER = 1;
export const compass = new HMC5883L(COMPASS_BUS_NUMBER, {
  calibration: {
    offset: { x: 87.23500000000001, y: 4.015000000000015, z: 60.955 },
    scale: { x: 1.149260226283725, y: 1.0995004163197335, z: 4.537800687285224 },
  },
});

setInterval(() => {
  compass.getHeadingDegrees('z', 'y', (err: unknown, heading: number) => store.heading.push(heading));
}, 200);

const port = new SerialPort('/dev/serial0', {
  baudRate: 9600,
});

// L298N pins on raspberry
// |27 -> IN3|
// |22 -> IN1| |23 -> IN4|
//             |24 -> IN2|

const GPIO_L298N_IN_1 = 22;
const GPIO_L298N_IN_2 = 24;
const GPIO_L298N_IN_3 = 27;
const GPIO_L298N_IN_4 = 23;

const RTForward = new Gpio(GPIO_L298N_IN_1, { mode: Gpio.OUTPUT });
const RTBackward = new Gpio(GPIO_L298N_IN_2, { mode: Gpio.OUTPUT });

const LTForward = new Gpio(GPIO_L298N_IN_4, { mode: Gpio.OUTPUT });
const LTBackward = new Gpio(GPIO_L298N_IN_3, { mode: Gpio.OUTPUT });

/** @desc Takes two values between -1 and 1 for both left and right engines. */
export const setEngines = (left: number, right: number) => {
  const MIN_POWER = 20;

  store.currentEngine = [left, right];

  left = Math.floor(clamp(left, -1, 1) * 255);
  right = Math.floor(clamp(right, -1, 1) * 255);

  console.log('Setting engines with', left, right);

  LTForward.pwmWrite(left > 0 ? left : 0);
  LTBackward.pwmWrite(left < 0 ? Math.abs(left) : 0);

  RTForward.pwmWrite(right > 0 ? right : 0);
  RTBackward.pwmWrite(right < 0 ? Math.abs(right) : 0);

  if (Math.abs(left) < MIN_POWER) {
    LTForward.digitalWrite(0);
    LTBackward.digitalWrite(0);
  }

  if (Math.abs(right) < MIN_POWER) {
    RTForward.digitalWrite(0);
    RTBackward.digitalWrite(0);
  }
};

const gps = new GPS();
const serial0 = port.pipe(new SerialPort.parsers.Readline({ delimiter: '\n' }));

serial0.on('data', (data) => {
  try {
    gps.update(data);
  } catch (e) {
    console.log('Error:', e);
  }
});

export type ParsedGpsDataNMEAType = 'GGA' | 'GLL' | 'RMC' | 'GSA' | 'VTG' | 'GSV' | 'ZDA' | 'GST' | 'HDT' | 'TXT';
export type ParsedGpsData = GGA | GLL | RMC | GSA | VTG | GSV | ZDA | GST | HDT;

gps.on('data', (data: ParsedGpsData) => {
  if (!data.valid) return;

  if (data.type === 'GGA' || data.type === 'GLL' || data.type === 'RMC') {
    if (data.lon == null) return;

    store.position.push({ time: data.time, nmeaType: data.type, lat: data.lat, lon: data.lon });
  }
});

console.log('Listening on port :80');

httpServer.listen(80);

console.log('Still listening...');

// forward(30_000);

onDeath(() => {
  console.log('Resetting engines');
  setEngines(0, 0);
  RTForward.digitalWrite(0);
  LTForward.digitalWrite(0);
  RTBackward.digitalWrite(0);
  LTBackward.digitalWrite(0);

  process.exit(0);
});
