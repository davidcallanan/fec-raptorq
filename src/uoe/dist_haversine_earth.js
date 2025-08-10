import { dist_haversine } from "./dist_haversine.js";

const EARTH_RADIUS_KM = 6371;

/**
 * @stability 3 - stable
 * 
 * Calculates the distance between two lat/long locations on Earth as the crow flies.
 * 
 * The Earth is taken to be a perfect sphere of radius 6371km, and the returned distance is in kilometers.
 */
export const dist_haversine_earth = (location_a, location_b) => dist_haversine(location_a, location_b, EARTH_RADIUS_KM);

export const distHaversineEarth = dist_haversine_earth;
