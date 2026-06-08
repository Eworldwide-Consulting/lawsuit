import { useState, useEffect, useCallback } from 'react';
import appointmentsApi from '../api/appointments.api';

export function useAppointments(upcomingOnly = false) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await (upcomingOnly ? appointmentsApi.upcoming() : appointmentsApi.list());
      setAppointments(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [upcomingOnly]);

  useEffect(() => { load(); }, [load]);

  return { appointments, loading, error, reload: load };
}