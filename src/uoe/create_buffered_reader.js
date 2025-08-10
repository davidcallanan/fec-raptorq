const FORCE_COMPACT_TRIGGER = 4096;

class BufferedReader {
	_init(stream) {
		this._stream = stream;
		this._buffer = new Uint8Array(0);
		this._offset = 0;
		this._is_closed = false;
	}

	async _ensure_bytes(num_bytes) {
		while (this._buffer.length - this._offset < num_bytes) {
			if (this._is_closed) {
				throw new Error("stream ended prematurely (stream closed)");
			}

			const { value: chunk, done } = await this._stream.read();

			if (true
				&& chunk !== undefined
				&& chunk.length > 0
			) {
				const new_buffer = new Uint8Array(this._buffer.length - this._offset + chunk.length);

				new_buffer.set(this._buffer.slice(this._offset));
				new_buffer.set(chunk, this._buffer.length - this._offset);
				this._buffer = new_buffer;
				this._offset = 0;
			}

			if (done) {
				this._is_closed = true;

				if (this._buffer.length - this._offset < num_bytes) {
					throw new Error("stream ended prematurely (stream closed)");
				}

				return;
			}
		}
	}

	async read(num_bytes) {
		if (num_bytes < 0) {
			throw error_user_payload("num_bytes must be positive");
		}

		if (num_bytes === 0) {
			return new Uint8Array(0);
		}

		await this._ensure_bytes(num_bytes);

		const result = this._buffer.subarray(this._offset, this._offset + num_bytes);
		this._offset += num_bytes;

		if (this._offset > FORCE_COMPACT_TRIGGER) {
			this._buffer = this._buffer.slice(this._offset);
			this._offset = 0;
		}

		return result;
	}
}

export const create_buffered_reader = create_unsuspended_factory(BufferedReader);

export const createBufferedReader = create_buffered_reader;
