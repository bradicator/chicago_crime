import { useState } from 'react';
import { useHealth, useUploadCsv } from '../hooks/useIncidents';

export default function Header() {
  const { data: health } = useHealth();
  const uploadMutation = useUploadCsv();
  const [showUpload, setShowUpload] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadMutation.mutateAsync(file);
      setShowUpload(false);
      // Refresh the page to reload data
      window.location.reload();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chicago Crime Analysis</h1>
            <p className="text-sm text-gray-500">
              {health?.database_loaded
                ? `${health.total_records.toLocaleString()} incidents loaded`
                : 'Loading data...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {health?.database_loaded && (
            <div className="text-sm text-gray-500">
              Data: {health.date_range_start} to {health.date_range_end}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              Upload CSV
            </button>

            {showUpload && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
                <p className="text-sm text-gray-600 mb-3">
                  Upload a Chicago crime CSV file to add data to the database.
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {uploadMutation.isPending && (
                  <p className="mt-2 text-sm text-gray-500">Uploading...</p>
                )}
                {uploadMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">
                    {uploadMutation.error.message}
                  </p>
                )}
                {uploadMutation.isSuccess && (
                  <p className="mt-2 text-sm text-green-600">
                    Loaded {uploadMutation.data.records_loaded} records
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            className={`w-3 h-3 rounded-full ${
              health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={health?.status || 'Unknown'}
          />
        </div>
      </div>
    </header>
  );
}
