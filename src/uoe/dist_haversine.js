const TO_RADIANS = Math.PI / 180;

/**
 * @stability 3 - stable
 * 
 * Calculates the distance between two lat/long locations on a sphere as the crow flies.
 * 
 * This function was adapted from https://stackoverflow.com/q/18883601/1541397
 */

export const dist_haversine = (location_a, location_b, sphere_radius) => {
	sphere_radius ??= 1;

	const lat_a = location_a.latitude  * TO_RADIANS;
	const lon_a = location_a.longitude * TO_RADIANS;
	const lat_b = location_b.latitude  * TO_RADIANS;
	const lon_b = location_b.longitude * TO_RADIANS;

	const dist_lat = lat_b - lat_a;
	const dist_lon = lon_b - lon_a;

	const a = Math.pow(Math.sin(dist_lat / 2), 2) + Math.cos(lat_a) * Math.cos(lat_b) * Math.pow(Math.sin(dist_lon / 2), 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
	
	return c * sphere_radius;
};

export const distHaversine = dist_haversine;
