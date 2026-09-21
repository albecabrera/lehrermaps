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
