import { test } from "./test.js";
import { compare_floats } from "./compare_floats.js";
import { dist_haversine } from "./dist_haversine.js";

test("null island", () => {
	return dist_haversine({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }) === 0;
});

test("north pole to south pole", () => {
	return compare_floats(dist_haversine({ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 0 }), Math.PI);
});

test("if Australia was on the equator", () => {
	return (() => {
		const I = [];

		for (let i = 0; i < 180; i++) {
			I.push(i);
		}

		return I;
	})().every((not_australia) => {
		const australia = not_australia + 180;
		return compare_floats(dist_haversine({ latitude: 0, longitude: australia }, { latitude: 0, longitude: not_australia }), Math.PI);
	});
});
