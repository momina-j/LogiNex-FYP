import osmnx as ox
import networkx as nx
import pandas as pd
from shapely.geometry import Point
from typing import List, Tuple
from geopy.distance import geodesic

# Set OSMnx to use local cache
ox.settings.use_cache = True
ox.settings.log_console = False

class RouteOptimizer:
    def __init__(self, mode: str = "drive"):
        """
        Initializes the optimizer for a specific mode (drive, walk, bike).
        """
        self.mode = mode
        self.graph = None
        self.last_bounds = None

    def _get_graph_for_points(self, points: List[Tuple[float, float]], buffer_meters: int = 2000):
        """
        Loads the OSM road network graph that covers all provided points.
        """
        # Calculate bounding box for all points
        lats, lngs = zip(*points)
        min_lat, max_lat = min(lats), max(lats)
        min_lng, max_lng = min(lngs), max(lngs)
        
        # Define the box with some buffer
        bbox = (max_lat + 0.02, min_lat - 0.02, max_lng + 0.02, min_lng - 0.02)
        
        # Check if we already have a graph covering this box
        if self.graph and self.last_bounds:
            mlat, nlat, mlng, nlng = self.last_bounds
            if (min_lat >= nlat and max_lat <= mlat and min_lng >= nlng and max_lng <= mlng):
                return self.graph

        print(f"Loading road network for the specified area (mode: {self.mode})...")
        self.graph = ox.graph_from_bbox(
            bbox=bbox, 
            network_type=self.mode, 
            simplify=True
        )
        self.last_bounds = bbox
        return self.graph

    def solve_tsp_nearest_neighbor(self, start_point: Tuple[float, float], stops: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Determines an efficient visiting order for stops using a Greedy Nearest Neighbor heuristic.
        """
        ordered_stops = []
        current_point = start_point
        remaining_stops = list(stops)

        while remaining_stops:
            # Find the nearest stop based on straight-line distance for initial ordering
            next_stop = min(remaining_stops, key=lambda s: geodesic(current_point, s).kilometers)
            ordered_stops.append(next_stop)
            remaining_stops.remove(next_stop)
            current_point = next_stop

        return ordered_stops

    def get_route(self, start_point: Tuple[float, float], stops: List[Tuple[float, float]]) -> dict:
        """
        Calculates the complete road-level shortest path for a sequence of stops.
        """
        try:
            # 1. Determine optimal visitor order
            ordered_stops = self.solve_tsp_nearest_neighbor(start_point, stops)
            full_itinerary = [start_point] + ordered_stops

            # 2. Load the graph
            graph = self._get_graph_for_points(full_itinerary)

            # 3. Find the nearest nodes in the graph for each point
            nodes = [ox.nearest_nodes(graph, p[1], p[0]) for p in full_itinerary]

            # 4. Calculate shortest paths between consecutive points using Dijkstra
            full_path_nodes = []
            total_distance = 0
            
            for i in range(len(nodes) - 1):
                try:
                    # Dijkstra calculation
                    path_segment = nx.shortest_path(graph, nodes[i], nodes[i+1], weight='length')
                    
                    # Calculate segment distance
                    segment_dist = nx.shortest_path_length(graph, nodes[i], nodes[i+1], weight='length')
                    total_distance += segment_dist
                    
                    # Add nodes (avoid duplicating consecutive stop nodes)
                    if i == 0:
                        full_path_nodes.extend(path_segment)
                    else:
                        full_path_nodes.extend(path_segment[1:])
                except nx.NetworkXNoPath:
                    print(f"No path found between {full_itinerary[i]} and {full_itinerary[i+1]}")
                    continue

            # 5. Convert nodes back to coordinates
            route_coords = []
            for node in full_path_nodes:
                point = graph.nodes[node]
                route_coords.append([point['y'], point['x']])

            # Estimates
            total_distance_km = total_distance / 1000.0
            avg_speed_kmh = 30 if self.mode == "drive" else 15 if self.mode == "bike" else 5
            estimated_time_mins = (total_distance_km / avg_speed_kmh) * 60

            return {
                "route": route_coords,
                "total_distance_km": round(total_distance_km, 2),
                "estimated_time_minutes": round(estimated_time_mins, 2),
                "ordered_itinerary": [[p[0], p[1]] for p in full_itinerary]
            }

        except Exception as e:
            print(f"Error in routing: {e}")
            return {"error": str(e)}

# global instance for reuse
optimizer = RouteOptimizer()
