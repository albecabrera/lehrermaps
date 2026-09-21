import XCTest
@testable import LehrerMaps

final class TimelinePolicyTests: XCTestCase {
    func testUsesNextSlotBoundaryWithoutPolling() {
        let calendar = Calendar(identifier: .gregorian)
        let now = calendar.date(from: DateComponents(year: 2026, month: 9, day: 7, hour: 8, minute: 15))!
        let snapshot = WidgetSnapshot(
            version: 1,
            date: "2026-09-07",
            generatedAt: "2026-09-07T08:15:00.000Z",
            schedule: WidgetSchedule(
                configured: true,
                current: nil,
                next: nil,
                slots: [WidgetSlot(label: "6a", room: nil, start: "08:00", end: "08:45", type: "lesson", block: .number(1))]
            ),
            openTaskCount: 0,
            nextAppointment: nil
        )
        let expected = calendar.date(from: DateComponents(year: 2026, month: 9, day: 7, hour: 8, minute: 45))!
        XCTAssertEqual(TimelinePolicy.nextRefresh(snapshot: snapshot, now: now, retrySoon: false), expected)
    }

    func testOfflineRetryWaitsThirtyMinutes() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertEqual(TimelinePolicy.nextRefresh(snapshot: nil, now: now, retrySoon: true), now.addingTimeInterval(1_800))
    }
}
