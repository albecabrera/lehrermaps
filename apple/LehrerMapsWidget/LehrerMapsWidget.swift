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
        completion(LehrerMapsEntry(date: Date(), snapshot: store.load() ?? Self.previewSnapshot, source: .cache))
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
        nextAppointment: WidgetAppointment(date: "2026-09-09", time: "14:30")
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
        .description("Aktueller Unterricht, nächste Termine und die Anzahl offener Aufgaben.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

private struct LehrerMapsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LehrerMapsEntry

    var body: some View {
        Group {
            switch family {
            case .systemSmall: smallView
            case .systemMedium: mediumView
            default: largeView
            }
        }
        .fontDesign(.rounded)
    }

    private var relevantSlot: WidgetSlot? {
        entry.snapshot?.schedule.current ?? entry.snapshot?.schedule.next ?? entry.snapshot?.schedule.slots.first
    }

    private var smallView: some View {
        Link(destination: DeepLinks.schedule) {
            VStack(alignment: .leading, spacing: 8) {
                header("JETZT / ALS NÄCHSTES", icon: "clock.fill")
                if let slot = relevantSlot {
                    Text(slot.label).font(.headline).lineLimit(2)
                    Text("\(slot.start)–\(slot.end)").font(.caption.monospacedDigit())
                    if let room = slot.room { Label("Raum \(room)", systemImage: "door.left.hand.open").font(.caption2).lineLimit(1) }
                } else {
                    emptyState
                }
                Spacer(minLength: 0)
                sourceLabel
            }
        }
    }

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 10) {
            header("MEIN SCHULTAG", icon: "map.fill")
            HStack(alignment: .top, spacing: 16) {
                Link(destination: DeepLinks.schedule) {
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(Array((entry.snapshot?.schedule.slots ?? []).prefix(3))) { slot in
                            slotRow(slot)
                        }
                        if entry.snapshot?.schedule.slots.isEmpty != false { emptyState }
                    }
                }
                Divider()
                Link(destination: DeepLinks.appointments) {
                    appointmentView
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            sourceLabel
        }
    }

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 14) {
            header("MEIN SCHULTAG", icon: "map.fill")
            Link(destination: DeepLinks.schedule) {
                VStack(spacing: 10) {
                    ForEach(Array((entry.snapshot?.schedule.slots ?? []).prefix(3))) { slot in
                        slotRow(slot)
                            .padding(10)
                            .background(Color("BrandPrimary").opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    }
                    if entry.snapshot?.schedule.slots.isEmpty != false { emptyState }
                }
            }
            Divider()
            Link(destination: DeepLinks.appointments) { appointmentView }
            Link(destination: DeepLinks.tasks) {
                Label("\(entry.snapshot?.openTaskCount ?? 0) offene Aufgaben", systemImage: "checklist")
                    .font(.headline)
                    .foregroundStyle(Color("BrandOrange"))
            }
            Spacer(minLength: 0)
            sourceLabel
        }
    }

    private func header(_ title: String, icon: String) -> some View {
        HStack {
            Label(title, systemImage: icon)
                .font(.caption.bold())
                .foregroundStyle(Color("BrandTeal"))
            Spacer()
            Circle().fill(Color("BrandOrange")).frame(width: 7, height: 7)
        }
    }

    private func slotRow(_ slot: WidgetSlot) -> some View {
        HStack(spacing: 8) {
            Text(slot.start).font(.caption.monospacedDigit()).foregroundStyle(Color("BrandTeal"))
            VStack(alignment: .leading, spacing: 1) {
                Text(slot.label).font(.subheadline.bold()).lineLimit(1)
                if let room = slot.room { Text("Raum \(room)").font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
            }
            Spacer(minLength: 0)
        }
    }

    private var appointmentView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Nächster Termin", systemImage: "calendar.badge.clock")
                .font(.caption.bold()).foregroundStyle(Color("BrandOrange"))
            if let appointment = entry.snapshot?.nextAppointment {
                Text(appointment.date).font(.subheadline.monospacedDigit())
                if let time = appointment.time { Text(time).font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
            } else {
                Text("Kein anstehender Termin").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var emptyState: some View {
        Label(entry.snapshot?.schedule.configured == false ? "Zeiten einrichten" : "Keine Einträge", systemImage: "calendar")
            .font(.caption).foregroundStyle(.secondary)
    }

    private var sourceLabel: some View {
        Label("\(sourceText) · \(entry.snapshot?.date ?? "kein Stand")", systemImage: sourceIcon)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
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
}
