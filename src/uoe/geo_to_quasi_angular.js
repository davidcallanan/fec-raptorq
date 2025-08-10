import { pos_mod } from "./pos_mod.js";

const EARTH_RADIUS = 6_371_000;
const TO_RADIANS = Math.PI / 180;

/**
 * @stability 1 - experimental
 * 
 * Takes in a geolocation and transforms it into a quasi-angular coordinate system.
 * 
 * In particular, small differences in x and y reflect 1 metre per unit of difference.
 * 
 * This is achieved by adjusting the x calculation based on the effective radius of Earth at the given latitude.
 * 
 * Accuracy diminishes significantly near poles.
 */
export const geo_to_quasi_angular = ({ latitude, longitude }) => {
    const y = pos_mod(latitude, 360) / 360 * 2 * Math.PI * EARTH_RADIUS;
	const effective_radius = EARTH_RADIUS * Math.cos(Math.abs(latitude) * TO_RADIANS);
	const x = pos_mod(longitude, 360) / 360 * 2 * Math.PI * effective_radius;

    return { x, y };
};

export const geoToQuasiAngular = geo_to_quasi_angular;
