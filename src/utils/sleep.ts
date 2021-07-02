export const sleep = (t: number) => new Promise((resolve) => setTimeout(() => resolve(undefined), t));

export default sleep;
