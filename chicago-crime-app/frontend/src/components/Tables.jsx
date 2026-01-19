import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';

// Type breakdown table
export function TypeBreakdownTable({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.by_type?.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="max-h-80 overflow-y-auto">
        <table className="data-table">
          <thead className="sticky top-0">
            <tr>
              <th>Type</th>
              <th className="text-right">Count</th>
              <th className="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {data.by_type.map((row) => (
              <tr key={row.primary_type}>
                <td className="font-medium">{row.primary_type}</td>
                <td className="text-right">{row.count.toLocaleString()}</td>
                <td className="text-right text-gray-500">{row.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Day/Hour pivot table
export function DayHourPivotTable({ data, isLoading }) {
  const pivotData = useMemo(() => {
    if (!data?.by_day_hour) return [];

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const matrix = days.map((day, i) => {
      const row = { day };
      const dayIndex = i === 6 ? 0 : i + 1; // Convert to DuckDB format

      for (let h = 0; h < 24; h++) {
        const entry = data.by_day_hour.find(
          (d) => d.day_of_week === dayIndex && d.hour === h
        );
        row[`h${h}`] = entry?.count || 0;
      }

      // Calculate row total
      row.total = Object.keys(row)
        .filter((k) => k.startsWith('h'))
        .reduce((sum, k) => sum + row[k], 0);

      return row;
    });

    return matrix;
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!pivotData.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No data available
      </div>
    );
  }

  const hours = Array(24).fill(0).map((_, i) => i);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="data-table text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-gray-50 z-10">Day</th>
            {hours.map((h) => (
              <th key={h} className="text-center px-1">
                {h.toString().padStart(2, '0')}
              </th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {pivotData.map((row) => (
            <tr key={row.day}>
              <td className="sticky left-0 bg-white font-medium z-10">{row.day}</td>
              {hours.map((h) => (
                <td key={h} className="text-center px-1 text-gray-600">
                  {row[`h${h}`] || '-'}
                </td>
              ))}
              <td className="text-right font-medium">{row.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Recent incidents table
export function RecentIncidentsTable({ incidents = [], isLoading }) {
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const sortedIncidents = useMemo(() => {
    const sorted = [...incidents].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return sorted.slice(0, 25);
  }, [incidents, sortField, sortDir]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (field !== sortField) return null;
    return (
      <span className="ml-1">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!incidents.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No incidents found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        <table className="data-table">
          <thead className="sticky top-0">
            <tr>
              <th
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date')}
              >
                Date/Time <SortIcon field="date" />
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('primary_type')}
              >
                Type <SortIcon field="primary_type" />
              </th>
              <th>Description</th>
              <th>Location</th>
              <th className="text-center">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sortedIncidents.map((incident) => (
              <tr key={incident.id}>
                <td className="whitespace-nowrap">
                  {format(
                    typeof incident.date === 'string'
                      ? parseISO(incident.date)
                      : incident.date,
                    'MM/dd/yy HH:mm'
                  )}
                </td>
                <td className="font-medium">{incident.primary_type}</td>
                <td className="text-gray-600 max-w-[200px] truncate">
                  {incident.description}
                </td>
                <td className="text-gray-600 max-w-[150px] truncate">
                  {incident.block}
                </td>
                <td className="text-center">
                  <div className="flex gap-1 justify-center">
                    {incident.arrest && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        A
                      </span>
                    )}
                    {incident.domestic && (
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        D
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Showing {sortedIncidents.length} of {incidents.length} incidents
        {' • '}
        A = Arrest, D = Domestic
      </div>
    </div>
  );
}
