import XCTest
@testable import LehrerMaps

final class WidgetSnapshotTests: XCTestCase {
    func testDecodesOnlyTheVersionedLeastDataContract() throws {
        let data = Data(#"""
        {
          "version": 1,
          "date": "2026-09-07",
          "generatedAt": "2026-09-07T08:15:00.000Z",
          "schedule": {
            "configured": true,
            "current": null,
            "next": {"label":"6a Informatik","room":"S10","start":"08:00","end":"08:45","type":"lesson","block":1},
            "slots": [{"label":"6a Informatik","room":"S10","start":"08:00","end":"08:45","type":"lesson","block":1}]
          },
          "openTaskCount": 2,
          "nextAppointment": {"date":"2026-09-09","time":"14:30"},
          "ignoredPrivateField": "must not persist"
        }
        """#.utf8)

        let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data).sanitized()
        XCTAssertEqual(snapshot.schedule.next?.label, "6a Informatik")
        XCTAssertEqual(snapshot.openTaskCount, 2)
        XCTAssertEqual(snapshot.nextAppointment, WidgetAppointment(date: "2026-09-09", time: "14:30"))
        XCTAssertFalse(String(data: try JSONEncoder().encode(snapshot), encoding: .utf8)!.contains("ignoredPrivateField"))
    }

    func testRejectsInvalidTimesAndCapsStoredValues() throws {
        let valid = WidgetSnapshot(
            version: 1,
            date: "2026-09-07",
            generatedAt: "2026-09-07T08:15:00.000Z",
            schedule: WidgetSchedule(configured: true, current: nil, next: nil, slots: Array(repeating: WidgetSlot(label: "  6a   Informatik  ", room: nil, start: "08:00", end: "08:45", type: "lesson", block: .number(1)), count: 5)),
            openTaskCount: 200,
            nextAppointment: nil
        )
        let sanitized = try valid.sanitized()
        XCTAssertEqual(sanitized.schedule.slots.count, 3)
        XCTAssertEqual(sanitized.schedule.slots[0].label, "6a Informatik")
        XCTAssertEqual(sanitized.openTaskCount, 20)

        let invalid = WidgetSlot(label: "6a", room: nil, start: "25:00", end: "26:00", type: "lesson", block: .number(1))
        XCTAssertThrowsError(try invalid.sanitized())
    }
}
