import Foundation
import WidgetKit

@MainActor
final class AuthViewModel: ObservableObject {
    enum State {
        case signedOut
        case loading
        case signedIn(WidgetSnapshot)
        case offline(WidgetSnapshot?)
        case expired
        case failure(String)
    }

    @Published private(set) var state: State = .signedOut
    @Published var password = ""

    private let api = APIClient()
    private let keychain = KeychainStore()
    private let snapshots = SnapshotStore()

    var configurationReady: Bool {
        keychain.isConfigured && AppConfiguration.appGroupIdentifier != nil
    }

    func restoreSession() async {
        guard configurationReady else {
            state = .failure("Konfiguriere zuerst die App Group und die Keychain-Zugriffsgruppe in Xcode.")
            return
        }
        do {
            guard try keychain.load() != nil else {
                state = .signedOut
                return
            }
            await refresh()
        } catch {
            state = .failure(error.localizedDescription)
        }
    }

    func signIn() async {
        guard !password.isEmpty else { return }
        state = .loading
        do {
            let token = try await api.login(password: password)
            try keychain.save(token: token)
            password = ""
            await refresh()
        } catch WidgetDataError.unauthorized {
            state = .failure("Das Passwort wurde nicht akzeptiert.")
        } catch {
            state = .failure(error.localizedDescription)
        }
    }

    func refresh() async {
        let cached = snapshots.load()
        state = .loading
        do {
            guard let token = try keychain.load() else {
                state = .signedOut
                return
            }
            let snapshot = try await api.fetchToday(token: token)
            try snapshots.save(snapshot)
            WidgetCenter.shared.reloadAllTimelines()
            state = .signedIn(snapshot)
        } catch WidgetDataError.unauthorized {
            keychain.delete()
            state = .expired
        } catch {
            state = .offline(cached)
        }
    }

    func signOut() {
        keychain.delete()
        snapshots.clear()
        WidgetCenter.shared.reloadAllTimelines()
        state = .signedOut
    }
}
