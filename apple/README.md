# LehrerMaps Apple Widget Companion

This self-contained Xcode project provides a SwiftUI companion app and WidgetKit extension for iPhone, iPad, and macOS. It uses only Apple frameworks and the existing LehrerMaps HTTPS API; there are no third-party packages or paid runtime services.

## Requirements

- Xcode 15 or later
- iOS 17 or later, iPadOS 17 or later, or macOS 14 or later
- An Apple signing team with App Groups and Keychain Sharing capabilities
- The production server endpoint `GET /api/widget/today?date=YYYY-MM-DD`

Linux/Plesk cannot build or sign this project. Open `LehrerMaps.xcodeproj` on macOS.

## Signing and shared storage setup

1. In `Config/Shared.xcconfig`, replace the three `de.example...` identifiers with identifiers registered for your Apple Developer team. Do not commit a Team ID or signing certificate.
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

Simulator device names vary by installed Xcode runtime. For a physical iPhone or iPad, select the device in Xcode, confirm signing, then Run. The app connects only to `https://lehrermaps.albertocabrera.de`; no HTTP exception is enabled.

## Use

1. Launch the companion app and sign in with the existing LehrerMaps password.
2. Tap **Refresh** once. The app stores the JWT in the shared Keychain and saves only the sanitized `WidgetSnapshot` in the App Group.
3. On iPhone/iPad, long-press the Home Screen, tap **+**, search for LehrerMaps, and add a small, medium, or large widget. On macOS, open Notification Center, choose **Edit Widgets**, and add LehrerMaps.
4. **Sign Out** deletes the shared token and cached snapshot.

The small widget shows the current or next schedule slot. Medium shows up to three slots and a generic appointment indicator. Large adds the open-task count. Appointment titles/classes/subjects/notes, task text, dashboard notes, folders, files, and student data are neither requested nor cached.

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
  "nextAppointment": { "date": "2026-09-09", "time": "14:30" }
}
```

`schedule.slots` contains at most three entries. Version-1 six-period schedules are supported. Break entries are emitted only when version-2 break ranges are explicitly present and chronological; no break times are inferred. The server reads bounded JSON fields and returns only normalized slot label/room/time/type/block, the task count, and generic appointment date/time.

## Timeline and offline behavior

The widget reads the App Group cache first, then attempts an authorized refresh with the shared Keychain token when the signing configuration permits it. A successful response replaces the cache. A network failure keeps the sanitized cache and marks it cached/offline; an expired token asks the user to reopen the companion app and sign in again.

Timeline updates are scheduled at the next known slot start/end boundary. With no remaining boundary, the next regular refresh is just after the next local day begins; transient network failures wait at least 30 minutes. WidgetKit may delay refreshes according to system budgets.

## Web deep links

Widgets use only these truthful routes:

- `https://lehrermaps.albertocabrera.de/#today`
- `https://lehrermaps.albertocabrera.de/#schedule`
- `https://lehrermaps.albertocabrera.de/#appointments`
- `https://lehrermaps.albertocabrera.de/#tasks`

Authentication happens separately in the web app. JWTs are sent only in the `Authorization: Bearer` header and are never placed in a deep-link URL. Arbitrary paths and query-parameter routes are not supported.

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
- **Deep link opens the wrong view**: use exactly one of the four documented hashes; paths and query routes are intentionally ignored.
- **Widget looks stale**: open the companion app and tap Refresh. WidgetKit controls final scheduling and can defer requested updates.
- **Xcode signing error**: replace every `de.example...` placeholder and select a team; do not add a Team ID to source control.

## Brand source

The Apple asset catalog includes a copy of the canonical Variant D concept only. Its source is `../docs/assets/logo-concepts/logo-d-map-book-preview.png`. Production PWA branding is intentionally untouched.
