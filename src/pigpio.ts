import { Gpio } from 'pigpio';

const led = new Gpio(17, { mode: Gpio.OUTPUT });

const dutyCycle = 0;

const PIN_MAGNET_SENSOR_DATA = 2;
const PIN_MAGNET_SENSOR_CLOCK = 3;

const PIN_GPS_TX = 14;
const PIN_GPS_RX = 15;
