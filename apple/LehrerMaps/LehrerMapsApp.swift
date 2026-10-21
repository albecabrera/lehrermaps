import SwiftUI
#if os(iOS)
import UIKit
#endif

@main
struct LehrerMapsApp: App {
    @StateObject private var model = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            #if os(iOS)
            ContentView()
                .environmentObject(model)
                .task { await model.restoreSession() }
                .onOpenURL { incomingURL in
                    guard let url = WidgetDestination.webURL(for: incomingURL) else { return }
                    UIApplication.shared.open(url)
                }
            #else
            ContentView()
                .environmentObject(model)
                .task { await model.restoreSession() }
            #endif
        }
    }
}
