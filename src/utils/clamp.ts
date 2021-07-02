export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

export default clamp;
