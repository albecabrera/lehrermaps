import Foundation

struct SnapshotStore {
    private let key = "widget-snapshot-v1"

    func save(_ snapshot: WidgetSnapshot) throws {
        guard let group = AppConfiguration.appGroupIdentifier,
              let defaults = UserDefaults(suiteName: group) else { throw WidgetDataError.invalidConfiguration }
        defaults.set(try JSONEncoder().encode(snapshot.sanitized()), forKey: key)
    }

    func load() -> WidgetSnapshot? {
        guard let group = AppConfiguration.appGroupIdentifier,
              let defaults = UserDefaults(suiteName: group),
              let data = defaults.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
              let sanitized = try? snapshot.sanitized() else { return nil }
        return sanitized
    }

    func clear() {
        guard let group = AppConfiguration.appGroupIdentifier,
              let defaults = UserDefaults(suiteName: group) else { return }
        defaults.removeObject(forKey: key)
    }
}
