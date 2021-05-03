import SerialPort from 'serialport';
import GPS, { GGA, GLL, GSA, GST, GSV, HDT, RMC, VTG, ZDA } from 'gps';
import { createObjectCsvWriter as csvFactory } from 'csv-writer';

const port = new SerialPort('/dev/serial0', {
  baudRate: 9600,
});

const gps = new GPS();
const serial0 = port.pipe(new SerialPort.parsers.Readline({ delimiter: '\r\n' }));

serial0.on('data', (data) => {
  console.log('Incoming data: ', data);
  gps.update(data);
});

const csv = csvFactory({
  path: '/home/pi/rover/gpsPath.csv',
  header: [
    { id: 'time', title: 'TIMESTAMP' },
    { id: 'nmeaType', title: 'NMEA' },
    { id: 'lat', title: 'LATITUDE' },
    { id: 'lon', title: 'LONGITUDE' },
  ],
});

console.log('Port running...');

export type ParsedGpsData = GGA | GLL | RMC | GSA | VTG | GSV | ZDA | GST | HDT;
export type ParsedGpsDataType = 'GGA' | 'GLL' | 'RMC' | 'GSA' | 'VTG' | 'GSV' | 'ZDA' | 'GST' | 'HDT';

gps.on('data', (data: ParsedGpsData) => {
  if (data.type === 'GGA' || data.type === 'GLL' || data.type === 'RMC') {
    csv.writeRecords([{ time: data.time, nmeaType: data.type, lat: data.lat, lon: data.lon }]);
  }
});
