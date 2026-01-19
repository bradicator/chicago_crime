import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';

// Fix for default marker icon issue in Leaflet + webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Chicago center coordinates
const CHICAGO_CENTER = [41.8781, -87.6298];
const DEFAULT_ZOOM = 11;

// Custom marker icon
const createIcon = (color = '#3b82f6') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

// Color mapping for incident types
const TYPE_COLORS = {
  'THEFT': '#f59e0b',
  'BATTERY': '#ef4444',
  'CRIMINAL DAMAGE': '#8b5cf6',
  'ASSAULT': '#dc2626',
  'BURGLARY': '#f97316',
  'MOTOR VEHICLE THEFT': '#06b6d4',
  'ROBBERY': '#be185d',
  'NARCOTICS': '#10b981',
  'DECEPTIVE PRACTICE': '#6366f1',
  'OTHER OFFENSE': '#64748b',
};

const getTypeColor = (type) => TYPE_COLORS[type] || '#3b82f6';

// Component to handle map click events
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Component to fly to a location
function FlyToLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo([location.latitude, location.longitude], 14, {
        duration: 1,
      });
    }
  }, [location, map]);

  return null;
}

// Component to fit bounds to incidents
function FitBounds({ location, radius }) {
  const map = useMap();

  useEffect(() => {
    if (location && radius && map) {
      // Wait for map to be ready
      const fitBounds = () => {
        try {
          const center = [location.latitude, location.longitude];
          // Calculate bounds manually instead of using L.circle
          const radiusInDegrees = (radius * 1.60934) / 111; // Approximate conversion
          const bounds = [
            [center[0] - radiusInDegrees, center[1] - radiusInDegrees],
            [center[0] + radiusInDegrees, center[1] + radiusInDegrees],
          ];
          map.fitBounds(bounds, { padding: [20, 20] });
        } catch (e) {
          console.warn('FitBounds error:', e);
        }
      };

      // Delay to ensure map is initialized
      setTimeout(fitBounds, 100);
    }
  }, [location, radius, map]);

  return null;
}

export default function Map({
  incidents = [],
  location,
  radius,
  onMapClick,
  isLoading,
}) {
  const markerIcon = useMemo(() => createIcon(), []);

  const markers = useMemo(() => {
    return incidents.slice(0, 2000).map((incident) => ({
      ...incident,
      icon: createIcon(getTypeColor(incident.primary_type)),
    }));
  }, [incidents]);

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden border border-gray-200">
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 z-[1000] flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Loading incidents...</span>
          </div>
        </div>
      )}

      <MapContainer
        center={CHICAGO_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={onMapClick} />

        {location && (
          <>
            <FlyToLocation location={location} />
            <FitBounds location={location} radius={radius} />

            {/* Search radius circle */}
            <Circle
              center={[location.latitude, location.longitude]}
              radius={radius * 1609.34} // Convert miles to meters
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />

            {/* Center marker */}
            <Marker
              position={[location.latitude, location.longitude]}
              icon={L.divIcon({
                className: 'center-marker',
                html: `<div style="
                  background-color: #3b82f6;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  border: 3px solid white;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Search Center</strong>
                  <br />
                  {location.display_name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Incident markers - limited to 500 for performance */}
        {markers.slice(0, 500).map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.latitude, incident.longitude]}
            icon={incident.icon}
          >
            <Popup className="incident-popup">
              <div className="min-w-[200px]">
                <div className="font-semibold text-gray-900 mb-1">
                  {incident.primary_type}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {incident.description}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>
                    <span className="font-medium">Date:</span>{' '}
                    {format(new Date(incident.date), 'MMM d, yyyy h:mm a')}
                  </div>
                  <div>
                    <span className="font-medium">Location:</span>{' '}
                    {incident.block || 'N/A'}
                  </div>
                  {incident.location_description && (
                    <div>
                      <span className="font-medium">Place:</span>{' '}
                      {incident.location_description}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    {incident.arrest && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        Arrest
                      </span>
                    )}
                    {incident.domestic && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        Domestic
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      {incidents.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000] max-w-[200px]">
          <div className="text-xs font-medium text-gray-700 mb-2">
            {incidents.length.toLocaleString()} incidents
            {incidents.length >= 2000 && ' (showing 2,000)'}
          </div>
          <div className="space-y-1">
            {Object.entries(TYPE_COLORS).slice(0, 5).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-600 truncate">{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
