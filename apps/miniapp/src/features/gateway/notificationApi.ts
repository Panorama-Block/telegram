// ============================================================================
// NOTIFICATION API
// API para gerenciar notificações do usuário
// ============================================================================

import { gatewayApi, type QueryParams } from './api';
import type {
  Notification,
  CreateNotificationInput,
  UpdateNotificationInput,
  PaginatedResponse,
  NotificationType,
} from './types';

const ENTITY = 'notifications';

// ----------------------------------------------------------------------------
// API Methods
// ----------------------------------------------------------------------------

export const notificationApi = {
  /**
   * Lista notificações do usuário
   */
  async list(
    userId: string,
    params?: Omit<QueryParams, 'where'> & {
      type?: NotificationType;
      unreadOnly?: boolean;
    }
  ): Promise<PaginatedResponse<Notification>> {
    const where: Record<string, unknown> = { userId, isDismissed: false };

    if (params?.type) where.type = params.type;
    if (params?.unreadOnly) where.isRead = false;

    return gatewayApi.list<Notification>(ENTITY, {
      where,
      orderBy: params?.orderBy || { createdAt: 'desc' },
      take: params?.take || 50,
      skip: params?.skip,
    });
  },

  /**
   * Busca notificação por ID
   */
  async get(id: string): Promise<Notification> {
    return gatewayApi.get<Notification>(ENTITY, id);
  },

  /**
   * Cria nova notificação
   */
  async create(data: CreateNotificationInput): Promise<Notification> {
    return gatewayApi.create<Notification>(ENTITY, {
      ...data,
      priority: data.priority || 'medium',
    });
  },

  /**
   * Marca notificação como lida
   */
  async markRead(id: string): Promise<Notification> {
    return gatewayApi.update<Notification>(ENTITY, id, {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  },

  /**
   * Marca todas as notificações como lidas
   */
  async markAllRead(userId: string): Promise<void> {
    const unread = await this.list(userId, { unreadOnly: true, take: 100 });

    await Promise.all(
      unread.data.map((n) => this.markRead(n.id))
    );
  },

  /**
   * Descarta notificação
   */
  async dismiss(id: string): Promise<Notification> {
    return gatewayApi.update<Notification>(ENTITY, id, {
      isDismissed: true,
    });
  },

  /**
   * Conta notificações não lidas
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.list(userId, { unreadOnly: true, take: 1 });
    // Como não temos count direto, fazemos uma estimativa
    // Em produção, seria melhor ter um endpoint específico
    const fullResult = await this.list(userId, { unreadOnly: true, take: 100 });
    return fullResult.data.length;
  },

  /**
   * Cria notificação de transação confirmada
   */
  async notifyTxConfirmed(
    userId: string,
    transactionId: string,
    details: { action: string; fromSymbol: string; toSymbol: string; amount: string },
    tenantId: string
  ): Promise<Notification> {
    return this.create({
      userId,
      transactionId,
      type: 'tx_confirmed',
      title: `${details.action} Confirmed`,
      message: `Your ${details.action.toLowerCase()} of ${details.amount} ${details.fromSymbol} to ${details.toSymbol} was successful.`,
      priority: 'medium',
      tenantId,
    });
  },

  /**
   * Cria notificação de transação falha
   */
  async notifyTxFailed(
    userId: string,
    transactionId: string,
    details: { action: string; errorMessage?: string },
    tenantId: string
  ): Promise<Notification> {
    return this.create({
      userId,
      transactionId,
      type: 'tx_failed',
      title: `${details.action} Failed`,
      message: details.errorMessage || `Your ${details.action.toLowerCase()} transaction failed. Please try again.`,
      priority: 'high',
      tenantId,
    });
  },
};

export default notificationApi;
