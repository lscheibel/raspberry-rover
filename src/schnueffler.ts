import { compass, setEngines } from './main.js';
import sleep from './utils/sleep.js';
import { SlidingBuffer } from './utils/index.js';

enum Direction {
  Forward,
  Backward,
  Left,
  Right,
}

let hasFoundWhatWeAreLookingFor = false;

const magnetValues = new SlidingBuffer<{ x: number; y: number; z: number }>(100);

const interval = setInterval(() => {
  try {
    compass.getRawValues((_: any, { x, y, z }: any) => {
      magnetValues.push({ x, y, z });

      const diff = (prop: 'x' | 'y' | 'z') =>
        Math.abs(magnetValues.latest()?.[prop] - magnetValues.previous()?.[prop]) || -Infinity;

      const SENSITIVITY = 200;
      const maxDiff = Math.max(...['x', 'y', 'z'].map((p: any) => diff(p)));

      if (maxDiff > SENSITIVITY) {
        console.log(maxDiff);
        hasFoundWhatWeAreLookingFor = true;
        clearInterval(interval);
      }
    });
  } catch (e) {
    console.log(e);
  }
}, 200);

const go = async (dir: Direction, sec: number) => {
  if (hasFoundWhatWeAreLookingFor) return;
  console.log('gogogog');

  const SPEED_MULTIPLIER = 1;

  let engines = [0, 0];

  switch (dir) {
    case Direction.Forward:
      engines = [1, 1];
      break;
    case Direction.Backward:
      engines = [-1, -1];
      break;
    case Direction.Left:
      engines = [-1, 1];
      break;
    case Direction.Right:
      engines = [1, -1];
      break;
    default:
      break;
  }

  setEngines(...(engines.map((v) => v * SPEED_MULTIPLIER) as [number, number]));
  await sleep(sec * 1000);
  setEngines(0, 0);
};

export const schnüffel = async () => {
  for (let i = 0; i < 10; i++) {
    const deg90Secs = 1;
    const dashSecs = 5;
    const smallSecs = 1;

    await go(Direction.Forward, dashSecs);
    await go(Direction.Right, deg90Secs);
    await go(Direction.Forward, smallSecs);
    await go(Direction.Right, deg90Secs);
    await go(Direction.Forward, dashSecs);
    await go(Direction.Left, deg90Secs);
    await go(Direction.Forward, smallSecs);
    await go(Direction.Left, deg90Secs);
  }
};
