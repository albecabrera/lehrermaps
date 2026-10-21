import SwiftUI
import WidgetKit

private enum WidgetSource: String {
    case live
    case cache
    case offline
    case expired
    case signedOut
}

private struct LehrerMapsEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let source: WidgetSource
}

private struct LehrerMapsProvider: TimelineProvider {
    private let store = SnapshotStore()
    private let keychain = KeychainStore()
    private let api = APIClient()

    func placeholder(in context: Context) -> LehrerMapsEntry {
        LehrerMapsEntry(date: Date(), snapshot: Self.previewSnapshot, source: .cache)
    }

    func getSnapshot(in context: Context, completion: @escaping (LehrerMapsEntry) -> Void) {
        let snapshot = store.load() ?? Self.previewSnapshot
        completion(LehrerMapsEntry(date: Date(), snapshot: snapshot, source: .cache))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LehrerMapsEntry>) -> Void) {
        Task {
            let cached = store.load()
            var snapshot = cached
            var source: WidgetSource = cached == nil ? .signedOut : .cache
            var retrySoon = false

            do {
                if let token = try keychain.load() {
                    let fresh = try await api.fetchToday(token: token)
                    try store.save(fresh)
                    snapshot = fresh
                    source = .live
                }
            } catch WidgetDataError.unauthorized {
                source = .expired
            } catch {
                source = cached == nil ? .offline : .cache
                retrySoon = true
            }

            let now = Date()
            let refresh = TimelinePolicy.nextRefresh(snapshot: snapshot, now: now, retrySoon: retrySoon)
            completion(Timeline(entries: [LehrerMapsEntry(date: now, snapshot: snapshot, source: source)], policy: .after(refresh)))
        }
    }

    static let previewSnapshot = WidgetSnapshot(
        version: 1,
        date: "2026-09-07",
        generatedAt: "2026-09-07T08:15:00.000Z",
        schedule: WidgetSchedule(
            configured: true,
            current: WidgetSlot(label: "6a Informatik", room: "S10", start: "08:00", end: "08:45", type: "lesson", block: .number(1)),
            next: WidgetSlot(label: "7b", room: "S11", start: "10:00", end: "10:45", type: "lesson", block: .number(3)),
            slots: [
                WidgetSlot(label: "6a Informatik", room: "S10", start: "08:00", end: "08:45", type: "lesson", block: .number(1)),
                WidgetSlot(label: "7b", room: "S11", start: "10:00", end: "10:45", type: "lesson", block: .number(3)),
            ]
        ),
        openTaskCount: 3,
        nextAppointment: WidgetAppointment(date: "2026-09-09", time: "14:30", title: "Klausur Klasse 6a"),
        openTasks: [WidgetTask(text: "Prepare the next lesson"), WidgetTask(text: "Review assignments")]
    )
}

struct LehrerMapsWidget: Widget {
    let kind = "LehrerMapsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LehrerMapsProvider()) { entry in
            LehrerMapsWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color("WidgetBackground") }
        }
        .configurationDisplayName("Mein Schultag")
        .description("Der Tagesüberblick mit Stundenplan und offenen Aufgaben.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
    }
}

private struct LehrerMapsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let entry: LehrerMapsEntry

    private var lessons: [WidgetSlot] {
        (entry.snapshot?.schedule.slots ?? []).filter { $0.type == "lesson" }
    }

    private var tasks: [WidgetTask] {
        entry.snapshot?.openTasks ?? []
    }

    private var contentSize: WidgetContentSize {
        switch family {
        case .systemSmall: .small
        case .systemMedium: .medium
        case .systemLarge: .large
        case .systemExtraLarge: .extraLarge
        @unknown default: .small
        }
    }

    private var visibleCount: Int {
        WidgetLayoutPolicy.visibleRows(for: contentSize, accessibilitySize: dynamicTypeSize.isAccessibilitySize)
    }

    private var showsScheduleRoom: Bool {
        (contentSize == .large || contentSize == .extraLarge) && !dynamicTypeSize.isAccessibilitySize
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Label("MEIN SCHULTAG", systemImage: "map.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(Color("BrandTeal"))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 2)
                Text(entry.snapshot?.date ?? "Heute")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            VStack(alignment: .leading, spacing: family == .systemSmall ? 5 : 8) {
                scheduleSection(compact: family == .systemSmall)
                Divider()
                tasksSection(compact: family == .systemSmall)
            }

            Spacer(minLength: 0)
            if family != .systemSmall { sourceLabel }
        }
        .fontDesign(.rounded)
    }

    private func scheduleSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 3 : 5) {
            Link(destination: DeepLinks.schedule) {
                Label("Stundenplan", systemImage: "calendar")
                    .font(.headline.bold())
                    .foregroundStyle(Color("BrandTeal"))
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            if lessons.isEmpty {
                Text(entry.snapshot?.schedule.configured == false ? "Zeiten einrichten" : "Kein Unterricht")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            } else {
                ForEach(Array(lessons.prefix(visibleCount))) { slot in
                    Link(destination: DeepLinks.schedule) {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(slot.start)
                                .font(compact ? .caption.monospacedDigit() : .subheadline.monospacedDigit())
                                .foregroundStyle(Color("BrandTeal"))
                            Text(slot.label)
                                .font(compact ? .subheadline.bold() : .body.bold())
                                .lineLimit(2)
                            if showsScheduleRoom, let room = slot.room {
                                Text(room)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .privacySensitive()
                }
                moreLink(total: lessons.count, visible: visibleCount, destination: DeepLinks.schedule, noun: "Stunden")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func tasksSection(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 3 : 5) {
            HStack(spacing: 4) {
                Link(destination: DeepLinks.tasks) {
                    Label("Meine Aufgaben", systemImage: "checklist")
                        .font(.headline.bold())
                        .foregroundStyle(Color("BrandOrange"))
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
                Spacer(minLength: 0)
                Link(destination: DeepLinks.newTask) {
                    Image(systemName: "plus.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color("BrandOrange"))
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Neue Aufgabe hinzufügen")
            }
            if tasks.isEmpty {
                Text("Keine offenen Aufgaben")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            } else {
                ForEach(Array(tasks.prefix(visibleCount).enumerated()), id: \.offset) { _, task in
                    Link(destination: DeepLinks.tasks) {
                        Text(task.text)
                            .font(compact ? .subheadline : .body)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .privacySensitive()
                }
                moreLink(total: max(tasks.count, entry.snapshot?.openTaskCount ?? 0), visible: min(tasks.count, visibleCount),
                         destination: DeepLinks.tasks, noun: "Aufgaben")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func moreLink(total: Int, visible: Int, destination: URL, noun: String) -> some View {
        if total > visible {
            Link("+\(total - visible) weitere \(noun)", destination: destination)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    private var sourceLabel: some View {
        Label(sourceText, systemImage: sourceIcon)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
    }

    private var sourceText: String {
        switch entry.source {
        case .live: "Aktualisiert"
        case .cache: "Cache"
        case .offline: "Offline"
        case .expired: "Erneut anmelden"
        case .signedOut: "Begleit-App öffnen"
        }
    }

    private var sourceIcon: String {
        switch entry.source {
        case .live: "checkmark.circle"
        case .cache: "clock.arrow.circlepath"
        case .offline: "wifi.slash"
        case .expired, .signedOut: "person.crop.circle.badge.exclamationmark"
        }
    }
}

private enum DeepLinks {
    static let schedule = URL(string: "https://lehrermaps.albertocabrera.de/#schedule")!
    static let appointments = URL(string: "https://lehrermaps.albertocabrera.de/#appointments")!
    static let tasks = URL(string: "https://lehrermaps.albertocabrera.de/#tasks")!
    static let newTask = URL(string: "https://lehrermaps.albertocabrera.de/#tasks-new")!
}
