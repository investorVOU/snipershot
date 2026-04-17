import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALERTS_KEY = 'snapshot_price_alerts';

export type AlertDirection = 'above' | 'below';

export interface PriceAlert {
  id: string;
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  targetPrice: number;
  direction: AlertDirection;
  triggered: boolean;
  createdAt: number;
}

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(ALERTS_KEY)
      .then((raw) => { if (raw) setAlerts(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const save = useCallback((items: PriceAlert[]) => {
    AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(items)).catch(() => {});
  }, []);

  const addAlert = useCallback((params: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>) => {
    const alert: PriceAlert = {
      ...params,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      triggered: false,
      createdAt: Date.now(),
    };
    setAlerts((prev) => {
      const next = [alert, ...prev];
      save(next);
      return next;
    });
    return alert.id;
  }, [save]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      save(next);
      return next;
    });
  }, [save]);

  const markTriggered = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) => a.id === id ? { ...a, triggered: true } : a);
      save(next);
      return next;
    });
  }, [save]);

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return { alerts, activeAlerts, triggeredAlerts, addAlert, removeAlert, markTriggered };
}
