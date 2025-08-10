import { call_as_async } from "../call_as_async.js";
import { create_promise_queue } from "../create_promise_queue.js";

const create_synchronized = (deps, boundary, accessor) => {
	const [signal, set_signal] = deps.create_signal(undefined);

	deps.create_render_effect(() => {
		const promise = call_as_async(accessor);

		if (boundary.promise_queue === undefined) {
			boundary.promise_queue = create_promise_queue();
			boundary._set_is_loading(true);
		}

		boundary.promise_queue.add(promise);

		const exposed_promise = (async () => {
			await boundary.promise_queue.all();
			let value = await promise;
			boundary.promise_queue = undefined;
			boundary._set_is_loading(false);
			return value;
		})();

		set_signal(exposed_promise);
	});

	return signal;
};

export const create_synchronization_boundary = (deps) => {
	deps.create_signal ??= deps.createSignal;
	deps.create_effect ??= deps.createEffect;
	deps.create_render_effect ??= deps.createRenderEffect;

	const [is_loading, set_is_loading] = deps.create_signal();

	const self = {
		_outstanding: new Set(),
		_promise_queue: undefined,
		_set_is_loading: set_is_loading,
		is_loading: is_loading,
		isLoading: is_loading,
	};

	self.create_synchronized = (accessor) => create_synchronized(deps, self, accessor);
	self.createSynchronized = self.create_synchronized;

	return self;
};

export const createSynchronizationBoundary = create_synchronization_boundary;
