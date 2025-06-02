import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import nearest_points
from geopy.distance import geodesic
import requests

response = requests.get('https://api.data.gov.my/weather/forecast')
wfcast_json = response.json()
wfcast_df = pd.json_normalize(wfcast_json)

wfcast_df = wfcast_df[['date', 'summary_forecast', 'min_temp', 'max_temp', 'location.location_name']]
wfcast_df.rename(columns={'location.location_name': 'location_name'}, inplace=True)
points_df = pd.read_csv('weather_station_base.csv')

rain_table = wfcast_df.merge(points_df, on='location_name', how='left')
weather_gdf = gpd.GeoDataFrame(
    rain_table,
    geometry=gpd.points_from_xy(rain_table.Longitude, rain_table.Latitude),
    crs="EPSG:4326"
)
weather_gdf['date'] = pd.to_datetime(weather_gdf['date'])

earliest_date = weather_gdf['date'].min()
cutoff_date = earliest_date + pd.Timedelta(days=2)

concessions = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp").to_crs("EPSG:4326")
concessions = concessions[concessions['country'].isin(['Malaysia'])]

station_points = weather_gdf[['location_name', 'Longitude', 'Latitude']].drop_duplicates()
station_points['geometry'] = gpd.points_from_xy(station_points.Longitude, station_points.Latitude)
station_gdf = gpd.GeoDataFrame(station_points, geometry='geometry', crs='EPSG:4326')

# Find nearest station and calculate distance
def get_nearest_station_info(row):
    concession_centroid = row.geometry.centroid
    nearest_station = station_gdf.geometry.distance(concession_centroid).sort_values().index[0]
    nearest_row = station_gdf.loc[nearest_station]
    
    # Compute geodesic distance in km
    dist_km = geodesic(
        (concession_centroid.y, concession_centroid.x),
        (nearest_row.Latitude, nearest_row.Longitude)
    ).km
    
    return pd.Series({
        'nearest_station': nearest_row.location_name,
        'distance_km': round(dist_km, 2)
    })

# Apply to concessions
concessions[['nearest_station', 'distance_km']] = concessions.apply(get_nearest_station_info, axis=1)

# Merge 7-day forecast from the matched station
concessions_forecast = pd.merge(
    concessions,
    weather_gdf,
    left_on='nearest_station',
    right_on='location_name',
    how='left'
)
concessions_forecast_3days = concessions_forecast[concessions_forecast['date'] <= cutoff_date]
concessions_forecast_3days = concessions_forecast_3days.reset_index(drop=True)
print(concessions_forecast_3days)
