import { useState, useCallback, useMemo } from 'react';
import { subDays } from 'date-fns';
import { keepPreviousData } from '@tanstack/react-query';
import Header from './components/Header';
import LocationSearch from './components/LocationSearch';
import FilterPanel from './components/FilterPanel';
import KPICards from './components/KPICards';
import Map from './components/Map';
import { TimeSeriesChart, TopTypesChart, DayHourHeatmap, QuarterlyTrendChart } from './components/Charts';
import { TypeBreakdownTable, DayHourPivotTable, RecentIncidentsTable } from './components/Tables';
import { useIncidentSearch, useStats, useExportCsv, useReverseGeocode } from './hooks/useIncidents';

const DEFAULT_FILTERS = {
  radius: 0.5,
  date_preset: '30d',
  date_from: subDays(new Date(), 30),
  date_to: new Date(),
  primary_types: null,
};

export default function App() {
  const [location, setLocation] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('charts');

  const reverseGeocode = useReverseGeocode();
  const exportMutation = useExportCsv();

  // Build query params
  const queryParams = useMemo(() => {
    if (!location) return null;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      radius: filters.radius,
      date_preset: filters.date_preset,
      date_from: filters.date_from?.toISOString().split('T')[0],
      date_to: filters.date_to?.toISOString().split('T')[0],
      primary_types: filters.primary_types,
    };
  }, [location, filters]);

  // Fetch data
  const {
    data: searchData,
    isLoading: searchLoading,
    isFetching: searchFetching,
    error: searchError,
  } = useIncidentSearch(queryParams, {
    placeholderData: keepPreviousData,
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
  } = useStats(queryParams, {
    placeholderData: keepPreviousData,
  });

  // Log errors for debugging
  if (searchError) console.error('Search error:', searchError);
  if (statsError) console.error('Stats error:', statsError);

  const isLoading = searchLoading || statsLoading;
  const isFetching = searchFetching || statsFetching;

  // Handle location selection
  const handleLocationSelect = useCallback((loc) => {
    setLocation(loc);
  }, []);

  // Handle map click
  const handleMapClick = useCallback(
    async (latlng) => {
      const loc = {
        latitude: latlng.lat,
        longitude: latlng.lng,
        display_name: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`,
      };

      // Try to reverse geocode for a nicer name
      try {
        const result = await reverseGeocode.mutateAsync({
          lat: latlng.lat,
          lon: latlng.lng,
        });
        loc.display_name = result.display_name;
      } catch (e) {
        // Keep the coordinate display name
      }

      setLocation(loc);
    },
    [reverseGeocode]
  );

  // Handle export
  const handleExport = useCallback(() => {
    if (!queryParams) return;
    exportMutation.mutate(queryParams);
  }, [queryParams, exportMutation]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-white p-4 overflow-y-auto">
          <div className="space-y-4">
            <LocationSearch
              onLocationSelect={handleLocationSelect}
              currentLocation={location}
            />

            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
            />

            {location && (
              <button
                onClick={handleExport}
                disabled={exportMutation.isPending || !searchData?.incidents?.length}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {exportMutation.isPending ? 'Exporting...' : 'Export CSV'}
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {!location ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Select a Location
                </h2>
                <p className="text-gray-600">
                  Search for an address, enter coordinates, or click on the map
                  to analyze crime incidents in that area.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error display */}
              {(searchError || statsError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  <strong>Error:</strong> {searchError?.message || statsError?.message}
                </div>
              )}

              {/* KPI Cards */}
              <KPICards stats={statsData} isLoading={statsLoading} />

              {/* Map */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Incident Map
                  </h2>
                  {isFetching && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </div>
                  )}
                </div>
                <div className="h-[400px]">
                  <Map
                    incidents={searchData?.incidents || []}
                    location={location}
                    radius={filters.radius}
                    onMapClick={handleMapClick}
                    isLoading={searchLoading}
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="border-b border-gray-200">
                  <div className="flex">
                    {[
                      { id: 'charts', label: 'Charts' },
                      { id: 'tables', label: 'Tables' },
                      { id: 'recent', label: 'Recent Incidents' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                          activeTab === tab.id
                            ? 'text-primary-600 border-primary-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  {activeTab === 'charts' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="lg:col-span-2">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Quarterly Crime Trend
                        </h3>
                        <QuarterlyTrendChart data={statsData} isLoading={statsLoading} />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Daily Incidents
                        </h3>
                        <TimeSeriesChart data={statsData} isLoading={statsLoading} />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Top Incident Types
                        </h3>
                        <TopTypesChart data={statsData} isLoading={statsLoading} />
                      </div>
                      <div className="lg:col-span-2">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Incidents by Day & Hour
                        </h3>
                        <DayHourHeatmap data={statsData} isLoading={statsLoading} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'tables' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Incidents by Type
                        </h3>
                        <TypeBreakdownTable data={statsData} isLoading={statsLoading} />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Day/Hour Breakdown
                        </h3>
                        <DayHourPivotTable data={statsData} isLoading={statsLoading} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'recent' && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Most Recent Incidents
                      </h3>
                      <RecentIncidentsTable
                        incidents={searchData?.incidents || []}
                        isLoading={searchLoading}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Query info */}
              {searchData && (
                <div className="text-xs text-gray-400 text-center">
                  Found {searchData.total_count.toLocaleString()} incidents
                  {searchData.returned_count < searchData.total_count &&
                    ` (showing ${searchData.returned_count.toLocaleString()})`}
                  {' • '}
                  Query time: {searchData.query_time_ms}ms
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
