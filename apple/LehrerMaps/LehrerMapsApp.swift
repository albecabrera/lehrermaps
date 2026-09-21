import SwiftUI

@main
struct LehrerMapsApp: App {
    @StateObject private var model = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .task { await model.restoreSession() }
        }
    }
}
