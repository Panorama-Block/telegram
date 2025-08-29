import type { FastifyInstance } from 'fastify';

import { getRedisClient } from '../redis/client.js';

// Armazenar métricas simples em memória
const metrics = {
  totalMessages: 0,
  totalUsers: new Set<number>(),
  totalChats: new Set<number>(),
  totalActions: 0,
  totalErrors: 0,
  apiCalls: {
    auth: 0,
    agents: 0,
  },
  startTime: Date.now(),
};

export function incrementMetric(metric: keyof typeof metrics, value?: any) {
  switch (metric) {
    case 'totalMessages':
      metrics.totalMessages++;
      break;
    case 'totalActions':
      metrics.totalActions++;
      break;
    case 'totalErrors':
      metrics.totalErrors++;
      break;
    case 'totalUsers':
      if (typeof value === 'number') {
        metrics.totalUsers.add(value);
      }
      break;
    case 'totalChats':
      if (typeof value === 'number') {
        metrics.totalChats.add(value);
      }
      break;
  }
}

export function incrementApiCall(api: 'auth' | 'agents') {
  metrics.apiCalls[api]++;
}

export async function registerMetricsRoutes(app: FastifyInstance) {
  // Endpoint público de métricas básicas
  app.get('/metrics', async () => {
    const uptime = Date.now() - metrics.startTime;
    const redis = getRedisClient();
    
    try {
      // Tentar conectar ao Redis para verificar status
      await redis.ping();
      
      return {
        status: 'healthy',
        uptime: Math.floor(uptime / 1000), // em segundos
        metrics: {
          total_messages: metrics.totalMessages,
          unique_users: metrics.totalUsers.size,
          unique_chats: metrics.totalChats.size,
          total_actions: metrics.totalActions,
          total_errors: metrics.totalErrors,
          api_calls: metrics.apiCalls,
        },
        services: {
          redis: 'connected',
          auth_api: process.env['AUTH_API_BASE'] ? 'configured' : 'not_configured',
          agents_api: process.env['AGENTS_API_BASE'] ? 'configured' : 'not_configured',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        status: 'degraded',
        uptime: Math.floor(uptime / 1000),
        metrics: {
          total_messages: metrics.totalMessages,
          unique_users: metrics.totalUsers.size,
          unique_chats: metrics.totalChats.size,
          total_actions: metrics.totalActions,
          total_errors: metrics.totalErrors,
          api_calls: metrics.apiCalls,
        },
        services: {
          redis: 'disconnected',
          auth_api: process.env['AUTH_API_BASE'] ? 'configured' : 'not_configured',
          agents_api: process.env['AGENTS_API_BASE'] ? 'configured' : 'not_configured',
        },
        timestamp: new Date().toISOString(),
        error: 'Redis connection failed',
      };
    }
  });

  // Health check mais detalhado
  app.get('/health', async () => {
    const redis = getRedisClient();
    const services = [];

    // Verificar Redis
    try {
      await redis.ping();
      services.push({ name: 'redis', status: 'healthy' });
    } catch (err) {
      services.push({ name: 'redis', status: 'unhealthy', error: (err as Error).message });
    }

    // Verificar configuração APIs externas
    if (process.env['AUTH_API_BASE']) {
      services.push({ name: 'auth_api', status: 'configured' });
    } else {
      services.push({ name: 'auth_api', status: 'not_configured' });
    }

    if (process.env['AGENTS_API_BASE']) {
      services.push({ name: 'agents_api', status: 'configured' });
    } else {
      services.push({ name: 'agents_api', status: 'not_configured' });
    }

    const allHealthy = services.every(s => s.status === 'healthy' || s.status === 'configured');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    };
  });
}
