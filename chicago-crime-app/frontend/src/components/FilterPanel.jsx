import { useState, useEffect } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTypes } from '../hooks/useIncidents';
import { subDays, subMonths, subYears } from 'date-fns';

const RADIUS_OPTIONS = [
  { value: 0.25, label: '0.25 miles' },
  { value: 0.5, label: '0.5 miles' },
  { value: 1, label: '1 mile' },
  { value: 2, label: '2 miles' },
  { value: 3, label: '3 miles' },
  { value: 5, label: '5 miles' },
];

const DATE_PRESETS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

export default function FilterPanel({ filters, onFiltersChange }) {
  const { data: types = [], isLoading: typesLoading } = useTypes();
  const [datePreset, setDatePreset] = useState('30d');
  const [showCustomDates, setShowCustomDates] = useState(false);

  const typeOptions = types.map((type) => ({
    value: type,
    label: type,
  }));

  const handleRadiusChange = (option) => {
    onFiltersChange({ ...filters, radius: option.value });
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    setShowCustomDates(preset === 'custom');

    if (preset !== 'custom') {
      const today = new Date();
      let dateFrom;

      switch (preset) {
        case '7d':
          dateFrom = subDays(today, 7);
          break;
        case '30d':
          dateFrom = subDays(today, 30);
          break;
        case '90d':
          dateFrom = subDays(today, 90);
          break;
        case '1y':
          dateFrom = subYears(today, 1);
          break;
        case 'all':
          dateFrom = null;
          break;
        default:
          dateFrom = subDays(today, 30);
      }

      onFiltersChange({
        ...filters,
        date_preset: preset,
        date_from: dateFrom,
        date_to: today,
      });
    }
  };

  const handleDateFromChange = (date) => {
    onFiltersChange({ ...filters, date_from: date, date_preset: 'custom' });
  };

  const handleDateToChange = (date) => {
    onFiltersChange({ ...filters, date_to: date, date_preset: 'custom' });
  };

  const handleTypesChange = (selected) => {
    onFiltersChange({
      ...filters,
      primary_types: selected?.length > 0 ? selected.map((s) => s.value) : null,
    });
  };

  const selectedTypes = filters.primary_types
    ? filters.primary_types.map((t) => ({ value: t, label: t }))
    : [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Filters</h3>

      {/* Radius */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Search Radius</label>
        <Select
          value={RADIUS_OPTIONS.find((o) => o.value === filters.radius)}
          onChange={handleRadiusChange}
          options={RADIUS_OPTIONS}
          className="text-sm"
          classNamePrefix="react-select"
          isSearchable={false}
        />
      </div>

      {/* Date preset buttons */}
      <div>
        <label className="block text-xs text-gray-500 mb-2">Date Range</label>
        <div className="grid grid-cols-3 gap-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handlePresetChange(preset.value)}
              className={`px-2 py-1.5 text-xs font-medium rounded ${
                datePreset === preset.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {showCustomDates && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <DatePicker
              selected={filters.date_from}
              onChange={handleDateFromChange}
              maxDate={filters.date_to || new Date()}
              className="w-full"
              dateFormat="MM/dd/yyyy"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <DatePicker
              selected={filters.date_to}
              onChange={handleDateToChange}
              minDate={filters.date_from}
              maxDate={new Date()}
              className="w-full"
              dateFormat="MM/dd/yyyy"
            />
          </div>
        </div>
      )}

      {/* Event types */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Event Types {selectedTypes.length > 0 && `(${selectedTypes.length} selected)`}
        </label>
        <Select
          isMulti
          value={selectedTypes}
          onChange={handleTypesChange}
          options={typeOptions}
          isLoading={typesLoading}
          placeholder="All types"
          className="text-sm"
          classNamePrefix="react-select"
          isClearable
          closeMenuOnSelect={false}
          maxMenuHeight={200}
        />
      </div>

      {/* Reset button */}
      <button
        onClick={() => {
          setDatePreset('30d');
          setShowCustomDates(false);
          onFiltersChange({
            radius: 0.5,
            date_preset: '30d',
            date_from: subDays(new Date(), 30),
            date_to: new Date(),
            primary_types: null,
          });
        }}
        className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
      >
        Reset Filters
      </button>
    </div>
  );
}
