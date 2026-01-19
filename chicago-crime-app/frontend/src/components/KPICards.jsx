export default function KPICards({ stats, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="kpi-card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats?.kpi) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-card-title">Total Incidents</div>
          <div className="kpi-card-value text-gray-300">--</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-title">Per Day</div>
          <div className="kpi-card-value text-gray-300">--</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-title">Top Type</div>
          <div className="kpi-card-value text-gray-300">--</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-title">Arrest Rate</div>
          <div className="kpi-card-value text-gray-300">--</div>
        </div>
      </div>
    );
  }

  const { kpi } = stats;
  const topType = kpi.top_types?.[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="kpi-card">
        <div className="kpi-card-title">Total Incidents</div>
        <div className="kpi-card-value">{kpi.total_incidents.toLocaleString()}</div>
        <div className="kpi-card-subtitle">
          in {kpi.date_range_days} day{kpi.date_range_days !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-title">Incidents / Day</div>
        <div className="kpi-card-value">{kpi.incidents_per_day.toFixed(1)}</div>
        <div className="kpi-card-subtitle">average</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-title">Top Type</div>
        <div className="kpi-card-value text-lg truncate" title={topType?.primary_type}>
          {topType?.primary_type || 'N/A'}
        </div>
        <div className="kpi-card-subtitle">
          {topType ? `${topType.count} (${topType.percentage}%)` : ''}
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-card-title">Arrest Rate</div>
        <div className="kpi-card-value">{kpi.arrests_percentage}%</div>
        <div className="kpi-card-subtitle">
          {kpi.arrests_count.toLocaleString()} arrests
        </div>
      </div>
    </div>
  );
}
