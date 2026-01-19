import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../api/client';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useTypes() {
  return useQuery({
    queryKey: ['types'],
    queryFn: api.getTypes,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useIncidentSearch(params, options = {}) {
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => api.searchIncidents(params),
    enabled: Boolean(params?.latitude && params?.longitude),
    ...options,
  });
}

export function useStats(params, options = {}) {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: () => api.getStats(params),
    enabled: Boolean(params?.latitude && params?.longitude),
    ...options,
  });
}

export function useGeocode() {
  return useMutation({
    mutationFn: api.geocode,
  });
}

export function useReverseGeocode() {
  return useMutation({
    mutationFn: ({ lat, lon }) => api.reverseGeocode(lat, lon),
  });
}

export function useUploadCsv() {
  return useMutation({
    mutationFn: api.uploadCsv,
  });
}

export function useExportCsv() {
  return useMutation({
    mutationFn: api.exportCsv,
    onSuccess: (data) => {
      // Create download link
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `chicago_crime_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });
}
