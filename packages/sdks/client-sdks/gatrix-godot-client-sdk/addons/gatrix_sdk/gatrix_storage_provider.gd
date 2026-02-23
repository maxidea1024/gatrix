# Gatrix Storage Provider Interface and Default Implementations
class_name GatrixStorageProvider


# Interface methods (override in custom implementations)
func get_value(key: String):
	return null

func save_value(key: String, value) -> void:
	pass

func delete_value(key: String) -> void:
	pass


# In-memory storage provider (default, no persistence)
class InMemoryStorageProvider extends GatrixStorageProvider:
	var _data: Dictionary = {}
	var _mutex := Mutex.new()

	func get_value(key: String):
		_mutex.lock()
		var val = _data.get(key)
		_mutex.unlock()
		return val

	func save_value(key: String, value) -> void:
		_mutex.lock()
		_data[key] = value
		_mutex.unlock()

	func delete_value(key: String) -> void:
		_mutex.lock()
		_data.erase(key)
		_mutex.unlock()


# File-based storage provider (persistent across sessions)
class FileStorageProvider extends GatrixStorageProvider:
	var _base_path: String
	var _mutex := Mutex.new()

	func _init(base_path := "user://gatrix_sdk/") -> void:
		_base_path = base_path
		DirAccess.make_dir_recursive_absolute(_base_path)

	func get_value(key: String):
		_mutex.lock()
		var path := _base_path + key.md5_text() + ".json"
		if not FileAccess.file_exists(path):
			_mutex.unlock()
			return null

		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			_mutex.unlock()
			return null

		var content := file.get_as_text()
		file.close()
		_mutex.unlock()

		var json := JSON.new()
		if json.parse(content) == OK:
			return json.data
		return null

	func save_value(key: String, value) -> void:
		_mutex.lock()
		var path := _base_path + key.md5_text() + ".json"
		var file := FileAccess.open(path, FileAccess.WRITE)
		if file:
			file.store_string(JSON.stringify(value))
			file.close()
		_mutex.unlock()

	func delete_value(key: String) -> void:
		_mutex.lock()
		var path := _base_path + key.md5_text() + ".json"
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(path)
		_mutex.unlock()
