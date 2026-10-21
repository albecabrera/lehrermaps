import Foundation
import AppIntents
import WidgetKit

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
        WidgetPageStore().clear()
    }
}

struct WidgetPageStore {
    private let offsetKey = "widget-page-offset-v1"
    private let dateKey = "widget-page-date-v1"

    private var defaults: UserDefaults? {
        AppConfiguration.appGroupIdentifier.flatMap(UserDefaults.init(suiteName:))
    }

    func offset(for snapshot: WidgetSnapshot?) -> Int {
        guard let snapshot else { return 0 }
        let lastIndex = max(0, itemCount(for: snapshot) - 1)
        guard let defaults, defaults.string(forKey: dateKey) == snapshot.date else {
            let relevant = snapshot.schedule.current ?? snapshot.schedule.next
            return min(snapshot.schedule.slots.firstIndex(where: { $0.id == relevant?.id }) ?? 0, lastIndex)
        }
        return min(max(defaults.integer(forKey: offsetKey), 0), lastIndex)
    }

    func move(by distance: Int) {
        guard let snapshot = SnapshotStore().load(), let defaults else { return }
        let lastIndex = max(0, itemCount(for: snapshot) - 1)
        let next = min(max(offset(for: snapshot) + distance, 0), lastIndex)
        defaults.set(snapshot.date, forKey: dateKey)
        defaults.set(next, forKey: offsetKey)
        WidgetCenter.shared.reloadTimelines(ofKind: "LehrerMapsWidget")
    }

    func clear() {
        defaults?.removeObject(forKey: offsetKey)
        defaults?.removeObject(forKey: dateKey)
    }

    private func itemCount(for snapshot: WidgetSnapshot) -> Int {
        snapshot.schedule.slots.count + (snapshot.nextAppointment == nil ? 0 : 1) + (snapshot.openTasks?.count ?? 0)
    }
}

struct PreviousWidgetItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Vorheriger Widget-Eintrag"
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        WidgetPageStore().move(by: -1)
        return .result()
    }
}

struct NextWidgetItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Nächster Widget-Eintrag"
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        WidgetPageStore().move(by: 1)
        return .result()
    }
}
