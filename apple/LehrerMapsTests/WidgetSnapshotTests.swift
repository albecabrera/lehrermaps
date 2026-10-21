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
          "openTasks": [{"text":"Prepare lesson","id":"must not persist","dueDate":"2026-09-08"}],
          "nextAppointment": {"title":" Parent   evening ","date":"2026-09-09","time":"14:30","notes":"must not persist"},
          "ignoredPrivateField": "must not persist"
        }
        """#.utf8)

        let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data).sanitized()
        XCTAssertEqual(snapshot.schedule.next?.label, "6a Informatik")
        XCTAssertEqual(snapshot.openTaskCount, 2)
        XCTAssertEqual(snapshot.openTasks, [WidgetTask(text: "Prepare lesson")])
        XCTAssertEqual(snapshot.nextAppointment, WidgetAppointment(date: "2026-09-09", time: "14:30", title: "Parent evening"))
        XCTAssertFalse(String(data: try JSONEncoder().encode(snapshot), encoding: .utf8)!.contains("ignoredPrivateField"))
        XCTAssertFalse(String(data: try JSONEncoder().encode(snapshot), encoding: .utf8)!.contains("dueDate"))
        XCTAssertFalse(String(data: try JSONEncoder().encode(snapshot), encoding: .utf8)!.contains("notes"))
    }

    func testRejectsInvalidTimesAndCapsStoredValues() throws {
        let valid = WidgetSnapshot(
            version: 1,
            date: "2026-09-07",
            generatedAt: "2026-09-07T08:15:00.000Z",
            schedule: WidgetSchedule(configured: true, current: nil, next: nil, slots: Array(repeating: WidgetSlot(label: "  6a   Informatik  ", room: nil, start: "08:00", end: "08:45", type: "lesson", block: .number(1)), count: 5)),
            openTaskCount: 200,
            nextAppointment: nil,
            openTasks: [WidgetTask(text: "  Prepare   lesson  "), WidgetTask(text: String(repeating: "x", count: 200))]
        )
        let sanitized = try valid.sanitized()
        XCTAssertEqual(sanitized.schedule.slots.count, 5)
        XCTAssertEqual(sanitized.schedule.slots[0].label, "6a Informatik")
        XCTAssertEqual(sanitized.openTaskCount, 20)
        XCTAssertEqual(sanitized.openTasks, [WidgetTask(text: "Prepare lesson"), WidgetTask(text: String(repeating: "x", count: 120))])

        let invalid = WidgetSlot(label: "6a", room: nil, start: "25:00", end: "26:00", type: "lesson", block: .number(1))
        XCTAssertThrowsError(try invalid.sanitized())
    }

    func testSanitizesAppointmentTitleAndKeepsOptionalTitleBackwardCompatible() throws {
        let appointment = try WidgetAppointment(
            date: "2026-09-09", time: "14:30", title: "  Parent   evening  "
        ).sanitized()
        XCTAssertEqual(appointment.title, "Parent evening")

        let legacy = try WidgetAppointment(date: "2026-09-09", time: nil).sanitized()
        XCTAssertNil(legacy.title)

        let longTitle = try WidgetAppointment(
            date: "2026-09-09", time: nil, title: String(repeating: "x", count: 120)
        ).sanitized()
        XCTAssertEqual(longTitle.title?.count, 80)
    }

    func testWidgetRowLimitsSupportReadableVerticalSections() {
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .small, accessibilitySize: false), 1)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .small, accessibilitySize: true), 1)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .medium, accessibilitySize: false), 1)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .medium, accessibilitySize: true), 1)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .large, accessibilitySize: false), 3)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .large, accessibilitySize: true), 2)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .extraLarge, accessibilitySize: false), 6)
        XCTAssertEqual(WidgetLayoutPolicy.visibleRows(for: .extraLarge, accessibilitySize: true), 3)
        XCTAssertEqual(WidgetLayoutPolicy.sectionOrder, [.schedule, .tasks])
    }

    func testAppointmentsAreHiddenInEveryFamily() {
        XCTAssertFalse(WidgetLayoutPolicy.showsAppointments)
    }
}
