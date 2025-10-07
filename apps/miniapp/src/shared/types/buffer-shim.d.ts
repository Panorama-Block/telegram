// Minimal type shim so TS can resolve the 'buffer' module in the browser build
declare module 'buffer' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Buffer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _default: any;
  export default _default;
}

