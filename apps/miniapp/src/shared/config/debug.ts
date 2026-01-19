const DEBUG_FLAG = (
  process.env.DEBUG ??
  ''
).toLowerCase();

export const DEBUG = ['1', 'true', 'on', 'yes'].includes(DEBUG_FLAG);
