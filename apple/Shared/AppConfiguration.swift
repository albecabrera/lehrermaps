import Foundation

enum AppConfiguration {
    static let apiBaseURL = URL(string: "https://lehrermaps.albertocabrera.de")!

    static var appGroupIdentifier: String? {
        configuredValue(for: "LEHRERMAPS_APP_GROUP")
    }

    static var keychainAccessGroup: String? {
        configuredValue(for: "LEHRERMAPS_KEYCHAIN_ACCESS_GROUP")
    }

    private static func configuredValue(for key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty, !value.contains("$("), !value.contains("example") else { return nil }
        return value
    }
}

enum WidgetDestination {
    static func webURL(for incomingURL: URL) -> URL? {
        guard let components = URLComponents(url: incomingURL, resolvingAgainstBaseURL: false),
              let base = URLComponents(url: AppConfiguration.apiBaseURL, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https",
              components.host?.lowercased() == base.host?.lowercased(),
              components.port == base.port,
              components.user == nil, components.password == nil,
              components.path == "/" || components.path.isEmpty,
              components.query == nil,
              let fragment = components.fragment,
              ["schedule", "appointments", "tasks", "tasks-new"].contains(fragment) else { return nil }

        var destination = base
        destination.path = "/"
        destination.fragment = fragment
        return destination.url
    }
}
