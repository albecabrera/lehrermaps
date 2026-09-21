import Foundation

struct WidgetSnapshot: Codable, Equatable {
    let version: Int
    let date: String
    let generatedAt: String
    let schedule: WidgetSchedule
    let openTaskCount: Int
    let nextAppointment: WidgetAppointment?

    func sanitized() throws -> WidgetSnapshot {
        guard version == 1, Self.isDate(date), Self.parseTimestamp(generatedAt) != nil else {
            throw WidgetDataError.invalidSnapshot
        }
        let slots = try schedule.slots.prefix(3).map { try $0.sanitized() }
        let current = try schedule.current?.sanitized()
        let next = try schedule.next?.sanitized()
        let appointment = try nextAppointment?.sanitized()
        return WidgetSnapshot(
            version: 1,
            date: date,
            generatedAt: generatedAt,
            schedule: WidgetSchedule(configured: schedule.configured, current: current, next: next, slots: slots),
            openTaskCount: min(max(openTaskCount, 0), 20),
            nextAppointment: appointment
        )
    }

    static func isDate(_ value: String) -> Bool {
        guard value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return false }
        return dateFormatter.date(from: value) != nil
    }

    static func parseTimestamp(_ value: String) -> Date? {
        timestampFormatter.date(from: value) ?? timestampFormatterWithoutFraction.date(from: value)
    }

    static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        return formatter
    }()

    private static let timestampFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let timestampFormatterWithoutFraction = ISO8601DateFormatter()
}

struct WidgetSchedule: Codable, Equatable {
    let configured: Bool
    let current: WidgetSlot?
    let next: WidgetSlot?
    let slots: [WidgetSlot]
}

struct WidgetSlot: Codable, Equatable, Identifiable {
    let label: String
    let room: String?
    let start: String
    let end: String
    let type: String
    let block: BlockValue

    var id: String { "\(start)-\(end)-\(type)-\(block.stringValue)" }

    func sanitized() throws -> WidgetSlot {
        guard ["lesson", "break"].contains(type),
              Self.isTime(start), Self.isTime(end), start < end,
              let label = Self.clean(label, maximum: 80) else {
            throw WidgetDataError.invalidSnapshot
        }
        return WidgetSlot(
            label: label,
            room: Self.clean(room, maximum: 40),
            start: start,
            end: end,
            type: type,
            block: block
        )
    }

    private static func isTime(_ value: String) -> Bool {
        value.range(of: #"^(?:[01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) != nil
    }

    private static func clean(_ value: String?, maximum: Int) -> String? {
        let normalized = (value ?? "").split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        guard !normalized.isEmpty else { return nil }
        return String(normalized.prefix(maximum))
    }
}

enum BlockValue: Codable, Equatable {
    case number(Int)
    case name(String)

    var stringValue: String {
        switch self {
        case .number(let value): String(value)
        case .name(let value): value
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Int.self) {
            self = .number(number)
        } else {
            self = .name(try container.decode(String.self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .number(let value): try container.encode(value)
        case .name(let value): try container.encode(value)
        }
    }
}

struct WidgetAppointment: Codable, Equatable {
    let date: String
    let time: String?

    func sanitized() throws -> WidgetAppointment {
        guard WidgetSnapshot.isDate(date) else { throw WidgetDataError.invalidSnapshot }
        if let time, time.range(of: #"^(?:[01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) == nil {
            throw WidgetDataError.invalidSnapshot
        }
        return self
    }
}

enum WidgetDataError: LocalizedError {
    case invalidConfiguration
    case invalidSnapshot
    case insecureTransport
    case unauthorized
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration: "App Group or Keychain access group is not configured."
        case .invalidSnapshot: "The server returned an invalid widget snapshot."
        case .insecureTransport: "LehrerMaps requires HTTPS."
        case .unauthorized: "The session has expired."
        case .server(let status): "The server returned HTTP \(status)."
        }
    }
}
