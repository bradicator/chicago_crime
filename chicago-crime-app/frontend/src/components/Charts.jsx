import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Area,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
];

// Time series chart
export function TimeSeriesChart({ data, isLoading }) {
  const chartData = useMemo(() => {
    if (!data?.daily_counts) return [];
    return data.daily_counts.map((d) => ({
      date: d.date,
      count: d.count,
      label: format(typeof d.date === 'string' ? parseISO(d.date) : d.date, 'MMM d'),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No data available</span>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            formatter={(value) => [value, 'Incidents']}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Top types bar chart
export function TopTypesChart({ data, isLoading }) {
  const chartData = useMemo(() => {
    if (!data?.by_type) return [];
    return data.by_type.slice(0, 10).map((d) => ({
      type: d.primary_type,
      count: d.count,
      percentage: d.percentage,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No data available</span>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            type="category"
            dataKey="type"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={100}
            tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            formatter={(value, name, props) => [
              `${value} (${props.payload.percentage}%)`,
              'Incidents',
            ]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Day/Hour heatmap
export function DayHourHeatmap({ data, isLoading }) {
  const { heatmapData, maxCount } = useMemo(() => {
    if (!data?.by_day_hour) return { heatmapData: [], maxCount: 0 };

    // Create a 7x24 matrix
    const matrix = Array(7).fill(null).map(() => Array(24).fill(0));
    let max = 0;

    data.by_day_hour.forEach((d) => {
      // DuckDB DAYOFWEEK: 0=Sunday, 1=Monday, etc.
      // We want: 0=Monday, 6=Sunday
      const dayIndex = d.day_of_week === 0 ? 6 : d.day_of_week - 1;
      matrix[dayIndex][d.hour] = d.count;
      if (d.count > max) max = d.count;
    });

    return { heatmapData: matrix, maxCount: max };
  }, [data]);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array(24).fill(0).map((_, i) => i);

  const getColor = (value) => {
    if (value === 0 || maxCount === 0) return '#f3f4f6';
    const intensity = value / maxCount;
    if (intensity > 0.8) return '#1e40af';
    if (intensity > 0.6) return '#3b82f6';
    if (intensity > 0.4) return '#60a5fa';
    if (intensity > 0.2) return '#93c5fd';
    return '#dbeafe';
  };

  if (isLoading) {
    return (
      <div className="h-48 bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading heatmap...</span>
      </div>
    );
  }

  if (!heatmapData.length) {
    return (
      <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No data available</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1">
          <div className="w-10"></div>
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex-1 text-center text-[10px] text-gray-500"
            >
              {hour % 3 === 0 ? `${hour}:00` : ''}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        {days.map((day, dayIndex) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-10 text-xs text-gray-500 text-right pr-2">{day}</div>
            <div className="flex-1 flex gap-0.5">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 h-5 rounded-sm cursor-pointer transition-transform hover:scale-110"
                  style={{ backgroundColor: getColor(heatmapData[dayIndex][hour]) }}
                  title={`${day} ${hour}:00 - ${heatmapData[dayIndex][hour]} incidents`}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end mt-3 gap-1">
          <span className="text-[10px] text-gray-500 mr-1">Less</span>
          {['#f3f4f6', '#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1e40af'].map((color) => (
            <div
              key={color}
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="text-[10px] text-gray-500 ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

// Quarterly trend chart
export function QuarterlyTrendChart({ data, isLoading }) {
  const chartData = useMemo(() => {
    if (!data?.quarterly_counts) return [];
    return data.quarterly_counts.map((d) => ({
      label: d.label,
      count: d.count,
      year: d.year,
      quarter: d.quarter,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No data available</span>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={50}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '12px',
            }}
            formatter={(value) => [value.toLocaleString(), 'Incidents']}
          />
          <Area
            type="monotone"
            dataKey="count"
            fill="#dbeafe"
            stroke="#3b82f6"
            strokeWidth={0}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#1d4ed8"
            strokeWidth={2}
            dot={{ fill: '#1d4ed8', r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
