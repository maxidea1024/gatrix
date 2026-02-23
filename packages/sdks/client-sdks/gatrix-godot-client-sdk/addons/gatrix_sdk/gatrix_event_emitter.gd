# Gatrix Event Emitter
# Thread-safe event emitter with on/once/off/onAny/offAny support
class_name GatrixEventEmitter

var _listeners: Dictionary = {}  # event_name -> Array[ListenerInfo]
var _any_listeners: Array = []  # Array[AnyListenerInfo]
var _next_handle: int = 1
var _handle_to_event: Dictionary = {}  # handle -> event_name
var _mutex := Mutex.new()


class ListenerInfo:
	var handle: int = 0
	var name: String = ""
	var callback: Callable
	var once: bool = false
	var call_count: int = 0
	var registered_at: float = 0.0


class AnyListenerInfo:
	var handle: int = 0
	var name: String = ""
	var callback: Callable  # func(event_name: String, args: Array)
	var call_count: int = 0
	var registered_at: float = 0.0


# Subscribe to an event. Returns handle for off().
func on(event_name: String, callback: Callable, listener_name := "") -> int:
	return _add_listener(event_name, callback, false, listener_name)


# Subscribe once. Listener auto-removed after first invocation.
func once(event_name: String, callback: Callable, listener_name := "") -> int:
	return _add_listener(event_name, callback, true, listener_name)


# Unsubscribe by handle
func off(handle: int) -> void:
	_mutex.lock()
	var event_name = _handle_to_event.get(handle, "")
	if event_name == "":
		_mutex.unlock()
		return

	if _listeners.has(event_name):
		var arr: Array = _listeners[event_name]
		for i in range(arr.size() - 1, -1, -1):
			if arr[i].handle == handle:
				arr.remove_at(i)
				break

	_handle_to_event.erase(handle)
	_mutex.unlock()


# Unsubscribe all listeners for an event
func off_event(event_name: String) -> void:
	_mutex.lock()
	if _listeners.has(event_name):
		var arr: Array = _listeners[event_name]
		for info in arr:
			_handle_to_event.erase(info.handle)
		_listeners.erase(event_name)
	_mutex.unlock()


# Subscribe to ALL events
func on_any(callback: Callable, listener_name := "") -> int:
	_mutex.lock()
	var handle := _next_handle
	_next_handle += 1

	var info := AnyListenerInfo.new()
	info.handle = handle
	info.name = listener_name if listener_name != "" else "any_listener_%d" % handle
	info.callback = callback
	info.call_count = 0
	info.registered_at = Time.get_unix_time_from_system()
	_any_listeners.append(info)
	_mutex.unlock()
	return handle


# Unsubscribe any-event listener by handle
func off_any(handle: int) -> void:
	_mutex.lock()
	for i in range(_any_listeners.size() - 1, -1, -1):
		if _any_listeners[i].handle == handle:
			_any_listeners.remove_at(i)
			break
	_mutex.unlock()


# Emit an event with arguments
func emit_event(event_name: String, args: Array = []) -> void:
	_mutex.lock()

	# Collect listeners to invoke (copy to avoid modification during iteration)
	var to_invoke: Array = []
	var to_remove: Array = []

	if _listeners.has(event_name):
		var arr: Array = _listeners[event_name]
		for info in arr:
			to_invoke.append(info)
			if info.once:
				to_remove.append(info.handle)

	var any_to_invoke: Array = _any_listeners.duplicate()
	_mutex.unlock()

	# Invoke listeners outside of lock
	for info in to_invoke:
		info.call_count += 1
		if args.size() == 0:
			info.callback.call()
		elif args.size() == 1:
			info.callback.call(args[0])
		else:
			info.callback.callv(args)

	# Invoke any-event listeners
	for info in any_to_invoke:
		info.call_count += 1
		info.callback.call(event_name, args)

	# Remove once listeners
	for handle in to_remove:
		off(handle)


# Get handler statistics for debugging
func get_handler_stats() -> Dictionary:
	_mutex.lock()
	var stats: Dictionary = {}

	for event_name in _listeners:
		var arr: Array = _listeners[event_name]
		var handlers: Array = []
		for info in arr:
			handlers.append({
				"name": info.name,
				"callCount": info.call_count,
				"isOnce": info.once,
				"registeredAt": info.registered_at,
			})
		stats[event_name] = handlers

	_mutex.unlock()
	return stats


func _add_listener(event_name: String, callback: Callable, is_once: bool, listener_name: String) -> int:
	_mutex.lock()
	var handle := _next_handle
	_next_handle += 1

	var info := ListenerInfo.new()
	info.handle = handle
	info.name = listener_name if listener_name != "" else "listener_%d" % handle
	info.callback = callback
	info.once = is_once
	info.call_count = 0
	info.registered_at = Time.get_unix_time_from_system()

	if not _listeners.has(event_name):
		_listeners[event_name] = []
	_listeners[event_name].append(info)
	_handle_to_event[handle] = event_name

	_mutex.unlock()
	return handle
