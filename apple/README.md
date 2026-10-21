# LehrerMaps Apple Widget Companion

This self-contained Xcode project provides a SwiftUI companion app and WidgetKit extension for iPhone, iPad, and macOS. It uses only Apple frameworks and the existing LehrerMaps HTTPS API; there are no third-party packages or paid runtime services.

## Requirements

- Xcode 15 or later
- iOS 17 or later, iPadOS 17 or later, or macOS 14 or later
- An Apple signing team with App Groups and Keychain Sharing capabilities
- The production server endpoint `GET /api/widget/today?date=YYYY-MM-DD`

Linux/Plesk cannot build or sign this project. Open `LehrerMaps.xcodeproj` on macOS.

### Personal Team installation (no paid membership)

For use on your own devices, Xcode can install development builds with a free Apple Account. Apple states that Personal Team provisioning profiles expire after seven days; rebuild and reinstall the iPhone and iPad app from Xcode when the profile expires. This is not a permanent distribution method and cannot publish the widget to other users. See [Apple's Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).

The existing widget requires App Groups and Keychain Sharing to share its sanitized snapshot and login token with the companion app. Confirm that Xcode can provision both capabilities for the selected team before installing on devices. If it cannot, stop rather than remove the entitlements, embed credentials, or place a token in a URL. The device owner must sign in to Xcode and approve device trust and any Apple security prompts locally; never share an Apple Account password or signing private key.

### Renew an iPhone or iPad installation

Personal Team provisioning profiles expire **seven days after issuance**. When an iPhone or iPad installation expires, reinstall the **whole signed app with its embedded widget extension** on that device; replacing or refreshing the widget alone does not renew its signature. No source edit or new project download is needed for this routine renewal.

1. On the MacBook, open the existing local `LehrerMaps.xcodeproj` in Xcode. Ensure your Apple Account is signed in under **Xcode → Settings → Accounts**.
2. In **Signing & Capabilities**, confirm **Automatically manage signing** is enabled and your **Personal Team** is selected for **both** the `LehrerMaps` and `LehrerMapsWidget` targets. Keep their App Groups and Keychain Sharing settings intact.
3. Connect and unlock the iPhone or iPad. Approve **Trust This Computer** only if the device asks.
4. Select the **LehrerMaps** scheme and that device as the run destination in Xcode, then press **Run** (⌘R). This rebuilds and reinstalls the app together with the embedded widget. If prompted, enable Developer Mode or trust your own Developer App certificate on the device.
5. Open LehrerMaps on the device and check that the widget appears and refreshes. If the widget is stale, use **Refresh** in the app. Repeat steps 3–5 separately for **each** iPhone and iPad.

The macOS build is a separate installation; this iPhone/iPad renewal procedure does not imply that the Mac widget needs a weekly reinstall. If widget source changes later, sync those changed files to the Mac project separately before building; routine profile renewal does not require changing source.

## Signing and shared storage setup

1. In `Config/Shared.xcconfig`, confirm the checked-in bundle and App Group identifiers are registered for your Apple Developer team. Do not commit a Team ID or signing certificate.
2. In Xcode, select the **LehrerMaps** target, choose your team, and add **App Groups** plus **Keychain Sharing** under Signing & Capabilities.
3. Repeat for **LehrerMapsWidget**. Both targets must use the exact same App Group and Keychain access group.
4. Ensure the host bundle identifier and widget bundle identifier match the values in `Shared.xcconfig` and your developer portal.

The checked-in entitlements use build-setting placeholders. `AppIdentifierPrefix` is supplied by Xcode signing; it is not a hard-coded Team ID.

## Build and test on macOS

From the `apple/` directory:

```sh
xcodebuild -project LehrerMaps.xcodeproj -scheme LehrerMaps -destination 'platform=iOS Simulator,name=iPhone 15' build
xcodebuild -project LehrerMaps.xcodeproj -scheme LehrerMaps -destination 'platform=iOS Simulator,name=iPhone 15' test
xcodebuild -project LehrerMaps.xcodeproj -scheme LehrerMaps -destination 'platform=macOS' build
xcodebuild -project LehrerMaps.xcodeproj -scheme LehrerMaps -destination 'platform=macOS' test
```

The `Apple widget CI` workflow runs unsigned Xcode tests on an iOS Simulator and macOS when Apple-project files change on `fix/widget-three-devices` or a pull request targeting `main` includes those files. It uses no signing credentials and validates compilation/tests only. It does **not** install, sign, or deploy the app to a physical Mac, iPhone, or iPad. To see a change on your devices, update the project on your Mac, open `LehrerMaps.xcodeproj` in Xcode, select each device as the run destination, and press **Run**; the device owner must complete any local signing or trust prompts.

Simulator device names vary by installed Xcode runtime. For a physical iPhone or iPad, select the device in Xcode, confirm signing, then Run. The app connects only to `https://lehrermaps.albertocabrera.de`; no HTTP exception is enabled.

## Use

1. Launch the companion app and sign in with the existing LehrerMaps password.
2. Tap **Refresh** once. The app stores the JWT in the shared Keychain and saves only the sanitized `WidgetSnapshot` in the App Group.
3. On iPhone/iPad, long-press the Home Screen, tap **Edit → Add Widget**, search for LehrerMaps or **Mein Schultag**, and add a small, medium, or large widget. On iPad and macOS, the extra-large family is available too. On macOS, open Notification Center, choose **Edit Widgets**, and add LehrerMaps.
4. **Sign Out** deletes the shared token and cached snapshot.

The widget shows the day's schedule first and open ToDos below it in one vertical column on every family and device size. The larger, Dynamic Type-aware text favors readability; smaller widgets show fewer rows, and overflow is summarized with a direct link to the relevant section. Termine are not shown in the widget. iPad and Mac also support the system extra-large family. WidgetKit does not support an internally scrollable list.

The authenticated widget response includes the full day's bounded schedule (up to eight slots), up to 20 open ToDo titles (120 characters each), and only the next appointment's bounded title/date/time. Task and appointment titles are stored in the shared App Group cache and marked privacy-sensitive in the widget. The device owner should consider whether this is appropriate for a visible Home Screen widget. Completed tasks, due dates, appointment classes/subjects/notes, dashboard notes, folders, files, and student data are neither requested nor cached. Signing out clears the snapshot and legacy page position.

## Widget API contract

`GET /api/widget/today?date=YYYY-MM-DD` requires a teacher JWT in the `Authorization: Bearer <token>` header. Missing dates, impossible calendar dates, and URL/query-string tokens are rejected. Responses use `Cache-Control: private, no-store` and schema version `1`:

```json
{
  "version": 1,
  "date": "2026-09-07",
  "generatedAt": "2026-09-07T08:15:00.000Z",
  "schedule": {
    "configured": true,
    "current": null,
    "next": { "label": "6a Informatik", "room": "S10", "start": "08:00", "end": "08:45", "type": "lesson", "block": 1 },
    "slots": []
  },
  "openTaskCount": 0,
  "openTasks": [{ "text": "Prepare lesson" }],
  "nextAppointment": { "title": "Klausur Klasse 6a", "date": "2026-09-09", "time": "14:30" }
}
```

`schedule.slots` contains the full configured day, at most eight entries. Version-1 six-period schedules are supported. Break entries are emitted only when version-2 break ranges are explicitly present and chronological; no break times are inferred. The server reads bounded JSON fields and returns only normalized slot label/room/time/type/block, the task count, bounded open-task titles, and the next appointment's normalized bounded title/date/time. Older version-1 clients ignore `openTasks` and the optional appointment title.

## Timeline and offline behavior

The widget reads the App Group cache first, then attempts an authorized refresh with the shared Keychain token when the signing configuration permits it. A successful response replaces the cache. A network failure keeps the sanitized cache and marks it cached/offline; an expired token asks the user to reopen the companion app and sign in again.

Timeline updates are scheduled at the next known slot start/end boundary. With no remaining boundary, the next regular refresh is just after the next local day begins; transient network failures wait at least 30 minutes. WidgetKit may delay refreshes according to system budgets.

## Web deep links

Widgets use only these truthful routes:

- `https://lehrermaps.albertocabrera.de/#today`
- `https://lehrermaps.albertocabrera.de/#schedule`
- `https://lehrermaps.albertocabrera.de/#appointments`
- `https://lehrermaps.albertocabrera.de/#tasks`
- `https://lehrermaps.albertocabrera.de/#tasks-new`

Authentication happens separately in the web app. JWTs are sent only in the `Authorization: Bearer` header and are never placed in a deep-link URL. Arbitrary paths and query-parameter routes are not supported.

The widget presents `Stundenplan` above `Meine Aufgaben` in one vertical column on every size. Small and medium families show up to one row per section, large shows three, and extra-large shows six; accessibility text sizes reduce the large and extra-large limits to two and three. Text uses larger Dynamic Type-aware system styles, and each item can wrap to two lines. A `+N weitere` link opens that section when the snapshot contains more items than the family displays. Termine are intentionally hidden in all widget families. Tapping a lesson or task opens its section directly. The task-section plus opens `#tasks-new`, which selects Heute and focuses its existing new-task field. Apple documents widgets as generally not supporting text input, so task text is entered in the app after this direct link ([WidgetKit documentation](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension)). Authenticated widget destinations skip the optional welcome animation/portal, while normal opens still show it; signed-out users still have to authenticate.

## Plesk/server notes

- Deploy the Node route through the existing Express service and reverse proxy; do not serve Apple source files.
- The repository `apple/.htaccess` denies direct Apache access because this directory is inside the document root.
- Do not use the top-level Plesk static mirrors as an Xcode build output directory.
- Keep HTTPS certificate renewal and the existing `/api` proxy healthy. The native client intentionally rejects non-HTTPS base URLs.

## Troubleshooting

- **Access denied when browsing `/apple/`**: expected. Apache must not expose source, project, or configuration files.
- **App Group cache is empty**: verify both targets have the same App Group entitlement and provisioning profile, then reinstall both app and widget.
- **Keychain item is unavailable**: verify the access-group suffix and Keychain Sharing capability match on both targets. Simulator entitlement changes often require deleting and reinstalling the app.
- **Session expired / HTTP 401**: open the companion app and sign in again. The current server token expires after 30 days and has no refresh-token flow.
- **CORS error**: native `URLSession` is not governed by browser CORS and sends no browser Origin header. Check reverse-proxy/API logs rather than adding wildcard CORS.
- **Deep link opens the login page**: sign in to the web app separately. The link intentionally contains no token.
- **Deep link opens the wrong view**: use one of the documented hashes; paths and query routes are intentionally ignored.
- **Widget looks stale**: open the companion app and tap Refresh. WidgetKit controls final scheduling and can defer requested updates.
- **Xcode signing error**: confirm the configured identifiers are registered for your team; do not add a Team ID to source control.

## Brand source

The Apple asset catalog includes a copy of the canonical Variant D concept only. Its source is `../docs/assets/logo-concepts/logo-d-map-book-preview.png`. Production PWA branding is intentionally untouched.
