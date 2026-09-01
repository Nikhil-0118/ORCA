import { useState, useEffect, useCallback } from 'react';
import { AlertItem } from '../types/alert.types';
import { alertsService } from '../services/alertsService';

export function useAlerts(lat: number = 13.0827, lon: number = 80.2707) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isSmsFallbackActive, setIsSmsFallbackActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await alertsService.getActiveAlerts(lat, lon);
      if (response.success) {
        setAlerts(response.data);
      }
    } catch {
      // In case of poor connectivity, flag SMS fallback status
      setIsSmsFallbackActive(true);
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // 1-minute live poll
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return { alerts, isSmsFallbackActive, loading, refetch: fetchAlerts };
}
