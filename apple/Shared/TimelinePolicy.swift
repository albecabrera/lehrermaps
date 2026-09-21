import Foundation

enum TimelinePolicy {
    static func nextRefresh(snapshot: WidgetSnapshot?, now: Date = Date(), retrySoon: Bool) -> Date {
        if let snapshot, snapshot.date == localDate(now) {
            let calendar = Calendar.current
            let boundaries = snapshot.schedule.slots.flatMap { slot -> [Date] in
                [slot.start, slot.end].compactMap { time in
                    let parts = time.split(separator: ":").compactMap { Int($0) }
                    guard parts.count == 2 else { return nil }
                    return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: now)
                }
            }.filter { $0 > now }.sorted()
            if let boundary = boundaries.first { return boundary }
        }
        if retrySoon { return now.addingTimeInterval(30 * 60) }
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(24 * 60 * 60)
        return Calendar.current.date(bySettingHour: 0, minute: 5, second: 0, of: tomorrow) ?? tomorrow
    }

    private static func localDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
