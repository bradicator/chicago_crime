import { useState } from 'react';
import { useGeocode } from '../hooks/useIncidents';

export default function LocationSearch({ onLocationSelect, currentLocation }) {
  const [address, setAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [mode, setMode] = useState('address'); // 'address' | 'coordinates'
  const geocodeMutation = useGeocode();

  const handleAddressSearch = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;

    try {
      const result = await geocodeMutation.mutateAsync(address);
      onLocationSelect({
        latitude: result.latitude,
        longitude: result.longitude,
        display_name: result.display_name,
      });
    } catch (error) {
      console.error('Geocoding failed:', error);
    }
  };

  const handleCoordinateSubmit = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (isNaN(lat) || isNaN(lon)) {
      alert('Please enter valid coordinates');
      return;
    }

    if (lat < 41.6 || lat > 42.1 || lon < -87.95 || lon > -87.5) {
      alert('Coordinates must be within Chicago city limits');
      return;
    }

    onLocationSelect({
      latitude: lat,
      longitude: lon,
      display_name: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Search Location</h3>

      {/* Mode tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setMode('address')}
          className={`px-4 py-2 text-sm font-medium -mb-px ${
            mode === 'address'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Address
        </button>
        <button
          onClick={() => setMode('coordinates')}
          className={`px-4 py-2 text-sm font-medium -mb-px ${
            mode === 'coordinates'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lat/Lon
        </button>
      </div>

      {mode === 'address' ? (
        <form onSubmit={handleAddressSearch}>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address in Chicago..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={geocodeMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {geocodeMutation.isPending ? '...' : 'Search'}
            </button>
          </div>
          {geocodeMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              {geocodeMutation.error.message}
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={handleCoordinateSubmit}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="41.8781"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="-87.6298"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Set Location
          </button>
        </form>
      )}

      {/* Current location display */}
      {currentLocation && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Current Location</p>
          <p className="text-sm text-gray-900 font-medium truncate">
            {currentLocation.display_name ||
             `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Tip: You can also click on the map to select a location
      </p>
    </div>
  );
}
