import numpy as _np
import pandas as _pd

from collections import defaultdict as _defaultdict

default_values = {
    '01A': 'homicide_violent',
    '03': 'robbery_violent',
    '04A': 'aggravated_assault_violent',
    '04B': 'aggravated_battery_violent',
    '05': 'burglary_nonviolent',
    '06': 'theft_nonviolent',
    '07': 'car_theft_nonviolent',
    '08A': 'simple_assault_violent',
    '08B': 'simple_battery_violent'
}
uci2name = _defaultdict(str, default_values)

def get_distance(longitudes, latitudes, ref_latitude, ref_longitude, dist_type='l1'):
    longitudes = _np.asarray(longitudes)
    latitudes = _np.asarray(latitudes)

    x_meter = _np.abs(longitudes - ref_longitude) * 82730
    y_meter = _np.abs(latitudes - ref_latitude) * 111375

    if dist_type == 'l1':
        distances = x_meter + y_meter
    else:
        distances = _np.sqrt(x_meter**2 + y_meter**2)

    return distances

class CrimeAnalyzer:
    default_values = {
        '01A': 'homicide_violent',
        '03': 'robbery_violent',
        '04A': 'aggravated_assault_violent',
        '04B': 'aggravated_battery_violent',
        '05': 'burglary_burglary',
        '06': 'theft_theft',
        '07': 'car_theft_theft',
        '08A': 'simple_assault_violent',
        '08B': 'simple_battery_violent'
    }
    uci2name = _defaultdict(str, default_values)

    def __init__(self, data_files) -> None:
        if isinstance(data_files, str):
            self.rawdf = _pd.read_csv(data_files)
        elif isinstance(data_files, list):
            temp = []
            for file in data_files:
                temp.append(_pd.read_csv(file))
                self.rawdf = _pd.concat(temp, axis=0)
        self.rawdf['FBI Code'] = self.rawdf['FBI Code'].apply(lambda x: uci2name[x])
        self.rawdf = self.rawdf.dropna(subset=['Latitude'])
        columns_to_select = ['Case Number', 'Date', 'Primary Type',
       'Description', 'Location Description', 'Arrest', 'Domestic', 'Beat',
       'District', 'Ward',  'FBI Code',  'Latitude', 'Longitude']
        column_mapping = {
            'Case Number': 'caseid',
            'Date': 'ts',
            'Block': 'block',
            'Primary Type': 'pdesp',
            'Description': 'sdesp',
            'Location Description': 'locdesp',
            'Arrest': 'arrest',
            'Domestic': 'domestic',
            'Beat': 'beat',
            "District": 'district',
            'WARD': 'ward',
            'FBI Code': 'category',
            'Latitude': 'latitude',
            'Longitude': 'longitude'
        }
        self.rawdf = self.rawdf[columns_to_select].rename(columns=column_mapping)
        self.rawdf['ts'] = _pd.to_datetime(self.rawdf['ts'])
        self.rawdf['violent'] = self.rawdf.category.apply(lambda x: x.split("_")[-1])
    
    def select_area(self, longitude, latitude, distance=500, distance_type="l1"):
        distances = get_distance(self.rawdf.longitude, self.rawdf.latitude, longitude, latitude, distance_type)
        self.focusdf = self.rawdf.loc[distances < distance, :].copy()
