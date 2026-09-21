import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AuthViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    Image("VariantD")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 112, height: 112)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .accessibilityLabel("LehrerMaps")

                    Text("LehrerMaps")
                        .font(.largeTitle.bold())
                        .foregroundStyle(Color("BrandPrimary"))

                    stateContent
                }
                .frame(maxWidth: 520)
                .padding(28)
            }
            .background(Color.secondary.opacity(0.08))
            .navigationTitle("Widget-Begleiter")
        }
    }

    @ViewBuilder
    private var stateContent: some View {
        switch model.state {
        case .signedOut:
            loginForm(message: "Melde dich einmal an, damit das Widget sicher aktualisiert werden kann.")
        case .loading:
            ProgressView("Wird aktualisiert…")
        case .signedIn(let snapshot):
            snapshotCard(snapshot, status: "Aktuell", offline: false)
            controls
        case .offline(let snapshot):
            if let snapshot { snapshotCard(snapshot, status: "Offline-Cache", offline: true) }
            Text("Der Server ist nicht erreichbar. Zwischengespeicherte Widget-Daten bleiben sichtbar.")
                .foregroundStyle(.secondary)
            controls
        case .expired:
            loginForm(message: "Deine Sitzung ist abgelaufen. Melde dich erneut an, um das Widget zu aktualisieren.")
        case .failure(let message):
            Text(message)
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
            loginForm(message: "Prüfe die Einrichtungsanleitung, falls die Signierung noch nicht vollständig konfiguriert ist.")
        }
    }

    private func loginForm(message: String) -> some View {
        VStack(spacing: 16) {
            Text(message).foregroundStyle(.secondary).multilineTextAlignment(.center)
            SecureField("LehrerMaps-Passwort", text: $model.password)
                .textContentType(.password)
                .padding(12)
                .background(.background, in: RoundedRectangle(cornerRadius: 12))
            Button("Anmelden") { Task { await model.signIn() } }
                .buttonStyle(.borderedProminent)
                .tint(Color("BrandTeal"))
        }
    }

    private func snapshotCard(_ snapshot: WidgetSnapshot, status: String, offline: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(status, systemImage: offline ? "wifi.slash" : "checkmark.circle.fill")
                .foregroundStyle(offline ? Color("BrandOrange") : Color("BrandTeal"))
            if let slot = snapshot.schedule.current ?? snapshot.schedule.next ?? snapshot.schedule.slots.first {
                Text(slot.label).font(.title2.bold())
                Text("\(slot.start)–\(slot.end)\(slot.room.map { " · Raum \($0)" } ?? "")")
                    .foregroundStyle(.secondary)
            } else {
                Text(snapshot.schedule.configured ? "Keine geplanten Einträge" : "Stundenplanzeiten sind nicht eingerichtet")
                    .font(.headline)
            }
            Text("\(snapshot.openTaskCount) offene Aufgaben")
                .foregroundStyle(.secondary)
            Text("Stand: \(snapshot.date)").font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var controls: some View {
        HStack {
            Button("Aktualisieren") { Task { await model.refresh() } }
                .buttonStyle(.borderedProminent)
                .tint(Color("BrandTeal"))
            Button("Abmelden", role: .destructive) { model.signOut() }
                .buttonStyle(.bordered)
        }
    }
}
