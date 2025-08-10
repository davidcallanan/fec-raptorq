import { internal_not_implemented_error } from "./internal_not_implemented_error.js";
import { throw_error } from "./throw_error.js";

export const not_implemented = () => throw_error(internal_not_implemented_error());
export const notImplemented = not_implemented();
