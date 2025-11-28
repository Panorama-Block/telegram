"use client";

import { useState, useCallback } from 'react';
import { tacApi } from './client';

export function useTacOperation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<any | null>(null);

  const startOperation = useCallback(async (body: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await tacApi.startOperation(body);
      setOperation(res?.data);
      return res?.data;
    } catch (e: any) {
      setError(e?.message || 'Failed to start operation');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOperation = useCallback(async (id: string) => {
    try {
      const res = await tacApi.getOperation(id);
      setOperation(res?.data);
      return res?.data;
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch operation');
      return null;
    }
  }, []);

  return { startOperation, fetchOperation, loading, error, operation };
}
