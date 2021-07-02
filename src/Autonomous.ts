import {
  clamp,
  getEngnieSpeedByDistance,
  signedAngleDifference,
  harmonicMean,
  geographicMidpointWithoutWeights,
  SlidingBuffer,
  getPathForScanningRectangle,
} from './utils/index.js';
import { performance } from 'perf_hooks';

import LatLon from 'geodesy/latlon-spherical.js';
import { store } from './data.js';
import { setEngines } from './main.js';

export type Rectangle = [LatLon, LatLon, LatLon, LatLon];

type Engines = [number, number];
type TankState = 'idle' | 'aligning' | 'approaching' | 'circumnavigate' | 'manual';

export class Tank {
  navigator;
  mcu;
  engines: Engines = [0, 0];
  state: TankState = 'idle';

  constructor(navigator: Navigator, mcu: MCU) {
    this.navigator = navigator;
    this.mcu = mcu;
  }

  next(engines: Engines) {
    this.engines = engines;

    this.updateState();
    this.updateEngines();

    this.engines = this.engines.map((v) => clamp(v, -1, 1)) as Engines;

    return this.engines;
  }

  updateState() {
    IdleTransition: if (this.state === 'idle') {
      if (Math.abs(this.mcu.desiredHeadingDelta) > 0.5) {
        this.state = 'aligning';
        break IdleTransition;
      }

      if (Math.abs(this.mcu.distanceToDestination) > 0.3) {
        this.state = 'approaching';
        break IdleTransition;
      }
    }

    this.updateEngines();
  }

  updateEngines() {
    switch (this.state) {
      case 'aligning': {
        this.alignToAngle(this.mcu.desiredHeadingDelta);
        break;
      }
      case 'approaching': {
        this.travelDistance(this.mcu.distanceToDestination);
        break;
      }
      default: {
        this.engines = this.toEngineValues(0);
        break;
      }
    }
  }

  travelDistance(distance: number) {
    let engine = 0;

    if (distance > 30) {
      engine = 1;
    }

    if (distance <= 30) {
      engine = getEngnieSpeedByDistance(distance, this.mcu.nVelocity);
    }

    this.engines = this.toEngineValues(engine);

    if (Math.abs(this.mcu.desiredHeadingDelta) > 1) {
      this.engines = this.engines.map((e, i) => {
        if (Math.sign(this.mcu.desiredHeadingDelta) === 1) {
          if (i % 2 !== 1) {
            return e / 4;
          }
          return e;
        } else {
          if (i % 2 !== 1) {
            return e;
          }
          return e / 4;
        }
      }) as Engines;
    }

    if (distance < 0.1 || Math.abs(this.mcu.desiredHeadingDelta) > 2) {
      // Condition when this function is done
      this.state = 'idle';
    }
  }

  alignToAngle(targetRotation: number) {
    const direction = targetRotation > 0 ? 'right' : 'left';
    let engine = 0;

    let fasterEngine: number;
    let slowerEngine: number;

    if (Math.abs(this.mcu.nVelocity) < 0.1) {
      // We're standing still
      engine = 0.84;
      if (Math.abs(this.mcu.nAngularVelocity) > 7) engine = 0.834;

      fasterEngine = engine;
      slowerEngine = -engine;
    } else {
      // We're driving
      fasterEngine = -Math.sign(this.mcu.nVelocity);
      slowerEngine = -Math.sign(this.mcu.nVelocity);
    }

    if (direction === 'right') {
      this.engines = [slowerEngine, fasterEngine];
    } else {
      this.engines = [fasterEngine, slowerEngine];
    }

    if (Math.abs(targetRotation) < 0.2 && this.mcu.nAngularVelocity < 0.01) {
      this.state = 'idle';
    }
  }

  toEngineValues(value: number) {
    if (value === 0) {
      return [0, 0] as Engines;
    }

    return this.engines.map(() => (Math.abs(value) / 2 + 0.5) * (value < 0 ? -1 : 1)) as Engines;
  }
}

export interface Location {
  latitude: number;
  longitude: number;
}

interface SensorValues {
  location: Location;
  heading: number;
  targetFinderSignal: number;
  clock: number;
}

export class MCU {
  destination: LatLon;
  position: LatLon;
  navigator: Navigator;

  // Buffer
  sensorDataBuffer = new SlidingBuffer<SensorValues>(5);
  velocityBuffer = new SlidingBuffer<number>(20);
  angularVelocityBuffer = new SlidingBuffer<number>(20);
  positionBuffer = new SlidingBuffer<LatLon>(10);
  headingBuffer = new SlidingBuffer<number>(25);

  // Computed Values
  distanceToDestination = 0;
  desiredHeading = 0;
  desiredHeadingDelta = 0;
  timeDelta = 0;

  // Normalized Vales
  nVelocity = 0;
  nAngularVelocity = 0;
  nPosition = new LatLon(0, 0);
  nHeading = 0;

  // Last Values
  lastNPosition = new LatLon(0, 0);

  constructor(position: LatLon, navigator: Navigator) {
    this.destination = navigator.currentDestination || position;
    this.navigator = navigator;
    this.position = position;
  }

  updateValues(sensorData: SensorValues) {
    this.sensorDataBuffer.push(sensorData);
    this.destination = this.navigator.currentDestination;
    const {
      location: { latitude, longitude },
      heading,
      clock,
    } = sensorData;

    this.position = new LatLon(latitude, longitude);

    if (this.positionBuffer.values.length) {
      this.lastNPosition = geographicMidpointWithoutWeights(this.positionBuffer.values);
    } else {
      this.lastNPosition = this.position;
    }

    this.positionBuffer.push(this.position);
    this.headingBuffer.push(heading);

    const previous = this.sensorDataBuffer?.previous() || sensorData;
    this.timeDelta = clock - (previous.clock || 0);

    const positionDelta = this.position.distanceTo(new LatLon(previous.location.latitude, previous.location.longitude));

    let headingDelta = this.headingBuffer.latest();
    if (this.headingBuffer.previous() != null) {
      headingDelta = signedAngleDifference(this.headingBuffer.latest(), this.headingBuffer.previous());
    }

    const angularVelocity = headingDelta / (this.timeDelta / 1000);
    this.angularVelocityBuffer.push(angularVelocity);
    this.nAngularVelocity = harmonicMean(this.angularVelocityBuffer.values);

    this.distanceToDestination = this.position.distanceTo(this.destination);

    this.desiredHeading = this.position.initialBearingTo(this.destination);
    this.desiredHeadingDelta = signedAngleDifference(this.nHeading, this.desiredHeading);

    if (isNaN(this.desiredHeading)) {
      this.desiredHeading = 0;
      this.desiredHeadingDelta = 0;
    }

    const velocity = positionDelta / (this.timeDelta / 1000);

    this.velocityBuffer.push(velocity);

    this.nVelocity = harmonicMean(this.velocityBuffer.values);
    this.nPosition = geographicMidpointWithoutWeights(this.positionBuffer.values);
    this.nHeading = harmonicMean(this.headingBuffer.values);

    if (this.distanceToDestination < 0.4 && this.nVelocity < 0.2) {
      this.navigator.reachedCurrentDestination();
    }
  }
}

export class Navigator {
  origin: LatLon;
  destinations: LatLon[];
  currentDestinationIndex = -1;
  detectionWidth = 1;

  constructor(origin: LatLon, destinations: LatLon[], detectionWidth: number) {
    this.origin = origin;
    this.destinations = destinations;
    this.detectionWidth = detectionWidth;
    if (destinations.length) {
      this.currentDestinationIndex = 0;
    }
  }

  get currentDestination() {
    if (this.destinations.length === 0) this.origin;
    return this.destinations[this.currentDestinationIndex];
  }

  reachedCurrentDestination() {
    if (this.currentDestinationIndex !== this.destinations.length - 1) this.currentDestinationIndex++;
  }

  addSearchArea(rectangle: Rectangle) {
    const lastDestination = this.destinations[this.destinations.length - 1] || this.origin;
    const rectanglePath = getPathForScanningRectangle(rectangle, lastDestination, this.detectionWidth);
    this.addDestinations(rectanglePath);
  }

  addDestinations(destinations: LatLon[]) {
    const updateCurrentDestination = this.destinations.length - 1 === this.currentDestinationIndex;
    this.destinations = [...this.destinations, ...destinations];
    if (updateCurrentDestination) this.reachedCurrentDestination();
  }
}

const origin = new LatLon(52.472579849222434, 13.408491315033999);
const detectionWidth = 1; // in m
const destinations: LatLon[] = [];
const searchArea: Rectangle = [
  new LatLon(52.47349201059195, 13.407833537403034), // Top left
  new LatLon(52.47349201059195, 13.408905206933467),
  new LatLon(52.47262544876193, 13.407833537403034),
  new LatLon(52.47262544876193, 13.408905206933467), // Bottom Right
];

export const navigator = new Navigator(origin, destinations, detectionWidth);
const mcu = new MCU(origin, navigator);

const tank = new Tank(navigator, mcu);

navigator.addSearchArea(searchArea);

const loop = () => {
  const position = store.position.latest();

  const sensorData: SensorValues = {
    location: new LatLon(position.lat, position.lon),
    heading: store.heading.latest(),
    clock: performance.now(),
    targetFinderSignal: 0,
  };

  mcu.updateValues(sensorData);

  const newEngineValues = tank.next(store.currentEngine as Engines);

  setEngines(...newEngineValues);
};

export const startAutonomous = () => {
  return setInterval(loop, 200);
};
