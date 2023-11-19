import numpy as _np
import pandas as _pd
import seaborn as _sns
import matplotlib.pyplot as _plt

from collections import defaultdict as _defaultdict
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
        '01B': 'manslaughter_violent',
        '02': 'sexual_assault_violent',
        '03': 'robbery_violent',
        '04A': 'aggravated_assault_violent',
        '04B': 'aggravated_battery_violent',
        '05': 'burglary_nonviolent',
        '06': 'theft_nonviolent',
        '07': 'car_theft_nonviolent',
        '08A': 'simple_assault_violent',
        '08B': 'simple_battery_violent',
        '10': 'forgery_nonviolent',
        '11': 'fraud_nonviolent',
        '12': 'embezzlement_nonviolent',
        '13': 'stolen_property_nonviolent',
        '14': 'vandalism_nonviolent',
        '15': 'weapon_violation_violent',
        '16': 'prostitution_nonviolent',
        '17': 'sex_abuse_nonviolent',
        '18': 'drug_abuse_nonviolent',
        '24': 'disorderly_conduct_nonviolent',
    }
    uci2name = _defaultdict(lambda : "uncategorized_nonviolent", default_values)

    def __init__(self, data_files) -> None:
        if isinstance(data_files, str):
            self.rawdf = _pd.read_csv(data_files)
        elif isinstance(data_files, list):
            temp = []
            for file in data_files:
                temp.append(_pd.read_csv(file))
                self.rawdf = _pd.concat(temp, axis=0)
        self.rawdf['FBI Code'] = self.rawdf['FBI Code'].apply(lambda x: CrimeAnalyzer.uci2name[x])
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
        self.rawdf.category = self.rawdf.category.apply(lambda x: x[:x.rfind("_")])
        self.clear_selection()
    
    def select_area(self, latitude, longitude, distance=500, distance_type="l1"):
        """
        specify latitude first because google map gives latitude first
        """
        self.clear_selection()
        distances = get_distance(self.rawdf.longitude, self.rawdf.latitude, latitude, longitude, distance_type)
        self.focusdf = self.rawdf.loc[distances < distance, :].copy()
        self.focusdf['year_quarter'] = self.focusdf.ts.dt.year.astype(str) + 'Q' + self.focusdf.ts.dt.quarter.astype(str)
        self.focus_radius = distance
        self.focus_center = (longitude, latitude)
    
    def clear_selection(self):
        self.focusdf = None
        self.focus_center = None
    
    def get_summary_count(self):
        if self.focusdf is None:
            raise ValueError("must select the area of interest.")
        vvc = self.focusdf.violent.value_counts()
            # vvc_str = f"This area has a total of {vvc.sum()} crimes, with {vvc['violent']} violent ones, {vvc['nonviolent']} non-violent ones, and {vvc['uncategorized']} uncategorized ones."
        cvc = self.focusdf.category.value_counts()
        return vvc, cvc
    
    def get_hourly_plot(self, by_violence=True):
        if self.focusdf is None:
            raise ValueError("must select the area of interest.")
        f, ax = _plt.subplots(figsize=(8, 6))
        if by_violence:
            countdf = self.focusdf.groupby(['violent', self.focusdf.ts.dt.hour])['category'].count().reset_index()
            bar_plot = _sns.barplot(x=countdf.ts, y=countdf.category, hue=countdf.violent, ax=ax)
        else:
            countdf = self.focusdf.groupby([self.focusdf.ts.dt.hour])['category'].count().reset_index()
            bar_plot = _sns.barplot(x=countdf.ts, y=countdf.category, ax=ax)
        ax.set(ylabel="Count", xlabel="Crime By Hour of Day")
        return f
    
    def get_density_plot(self):
        if self.focusdf is None:
            raise ValueError("must select the area of interest.")
        joint_plot = _sns.jointplot(x=self.focusdf.longitude, y=self.focusdf.latitude, 
                                    hue=self.focusdf.violent, marker="+", s=25, height=6)
        if self.focus_center:
            joint_plot.ax_joint.scatter(*self.focus_center, marker='*', s=200)
        joint_plot.ax_joint.set(ylabel="Latitude", xlabel="Longitude")
        joint_plot.fig.suptitle("Crime Density Map")
        return joint_plot
    
    def get_quarterly_plot(self, by_violence=True):
        if self.focusdf is None:
            raise ValueError("must select the area of interest.")
        f, ax = _plt.subplots(figsize=(8, 6))
        if by_violence:
            countdf = self.focusdf.groupby(['year_quarter','violent'])['category'].count().reset_index()
            bar_plot = _sns.barplot(x=countdf.year_quarter, y=countdf.category, hue=countdf.violent, ax=ax)
        else:
            countdf = self.focusdf.groupby(['year_quarter'])['category'].count().reset_index()
            bar_plot = _sns.barplot(x=countdf.year_quarter, y=countdf.category, ax=ax)
        ax.set(ylabel="Count", xlabel="Crime by Quarter")
        return f
        
    def get_report(self, by_violence=True, address=None):
        if self.focusdf is None:
            raise ValueError("must select the area of interest.")
        if address is None:
            address = f"coordinate ({self.focus_center[0]:.3f}, {self.focus_center[1]:.3f})"
        vvc, cvc = self.get_summary_count()
        print(f"Found {vvc.sum()} crimes in total for area within {self.focus_radius}m of "+address+":")
        print("====================================================")
        print("Crime Count By Violence:\n", vvc[:5].to_csv(header=False))
        print("Top Crime Types:\n", cvc[:5].to_csv(header=False))
        _ = self.get_hourly_plot(by_violence)
        self.get_density_plot()
        _ = self.get_quarterly_plot(by_violence)
        return 

        

    
