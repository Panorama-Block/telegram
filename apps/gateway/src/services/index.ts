import type { Api, RawApi } from 'grammy';
import { Notifier } from './notifier.js';
import { TxTracker } from './txTracker.js';
import { BalanceWatcher } from './balanceWatcher.js';
import { PriceAlertService } from './priceAlerts.js';

export interface Services {
  notifier: Notifier;
  txTracker: TxTracker;
  balanceWatcher: BalanceWatcher;
  priceAlerts: PriceAlertService;
}

let instance: Services | null = null;

/**
 * Initialize all background services.
 * Must be called once with the bot API after bot creation.
 */
export function initServices(api: Api<RawApi>): Services {
  const notifier = new Notifier(api);
  const txTracker = new TxTracker(notifier);
  const balanceWatcher = new BalanceWatcher(notifier);
  const priceAlerts = new PriceAlertService(notifier);

  instance = { notifier, txTracker, balanceWatcher, priceAlerts };
  return instance;
}

/**
 * Get the initialized services singleton.
 * Throws if called before initServices.
 */
export function getServices(): Services {
  if (!instance) throw new Error('Services not initialized. Call initServices first.');
  return instance;
}

/**
 * Start all background polling services.
 */
export function startServices(): void {
  if (!instance) throw new Error('Services not initialized');
  instance.txTracker.start();
  instance.balanceWatcher.start();
  instance.priceAlerts.start();
  console.log('[Services] All background services started');
}

/**
 * Stop all background polling services.
 */
export function stopServices(): void {
  if (!instance) return;
  instance.txTracker.stop();
  instance.balanceWatcher.stop();
  instance.priceAlerts.stop();
  console.log('[Services] All background services stopped');
}
