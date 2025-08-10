import { bigint_encode } from "./bigint_encode.js";
import { create_lock } from "./create_lock.js";
import { create_unsuspended_factory } from "./create_unsuspended_factory.js";
import { error_internal } from "./error_internal.js";
import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

class AtomicFile {
	async _init(dependencies, options) {
		this._dependencies = dependencies;
		this._options = options;

		this._write_lock = create_lock();

		this._path_a = this._dependencies.path.join(this._options.path_base, "a.dat");
		this._path_b = this._dependencies.path.join(this._options.path_base, "b.dat");
		this._path_t = this._dependencies.path.join(this._options.path_base, "t.dat");

		await this._dependencies.fs.mkdir(this._options.path_base, { recursive: true });
	}

	async _recover() {
		await this._dependencies.fs.rm(this._path_t, { force: true });

		try {
			var b_stat = await this._dependencies.fs.stat(this._path_b);
		} catch (e) {
			if (e.code !== "ENOENT") {
				throw e;
			}
		}

		if (b_stat !== undefined) {
			if (!b_stat.isFile()) {
				throw_error(error_internal("Assertion failed: file in the way."));
			}

			await this._dependencies.fs.rm(this._path_a, { force: true });
			await this._dependencies.fs.rename(this._path_b, this._path_a);
		}
	}

	async write(payload) {
		if (!payload instanceof Uint8Array) {
			throw_error(error_user_payload("Provided payload must be Uint8Array."));
		}

		if (payload.length >= Math.pow(2, 32)) {
			throw_error(error_user_payload("Length of provided payload must fit in 32 bits."));
		}

		return await this._write_lock.acquire(async () => {
			await this._recover();

			const length = bigint_encode(BigInt(payload.length), 4);
			const entire = new Uint8Array(length.length + payload.length);

			entire.set(length, 0);
			entire.set(payload, length.length);

			const encoded = entire; // TODO: reed-solomon encode

			const fd = await this._dependencies.fs.open(this._path_t, "w");

			await fd.write(encoded, 0, encoded.length, 0);
			await fd.sync();
			await fd.close();

			await this._dependencies.fs.rename(this._path_t, this._path_b);

			const fd_base = await this._dependencies.fs.opendir(this._options.path_base);

			// TODO: fsync directory here.

			await fd_base.close();

			await this._recover();
		});
	}

	async read() {
		return await this._write_lock.acquire(async () => {
			await this._recover();

			const data = await this._dependencies.fs.readFile(this._path_a);

			const decoded = data; // TODO: reed-solomon decode

			return decoded;
		});
	}
}

/**
 * Creates a custom file with atomic write semantics and reed-solomon coding.
 * 
 * It is undefined behaviour if more than one instance of an underlying file is live at a time.
 * 
 * Three POSIX files are used internally (`a.dat`, `b.dat`, and `t.dat`).
 * 
 * This implementation favours reliability and durability over performance. If you perform more than 50 writes per second within a system that has competing work to do, you should assess the performance degradation. It might be appropriate to use a write-ahead log alongside an atomic file to improve performance and minimize atomic writes.
 */
export const create_atomic_file = create_unsuspended_factory(AtomicFile);
