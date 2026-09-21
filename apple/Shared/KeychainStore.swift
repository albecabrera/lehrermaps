import Foundation
import Security

struct KeychainStore {
    private let service = "de.lehrermaps.widget-auth"
    private let account = "teacher-token"

    var isConfigured: Bool { AppConfiguration.keychainAccessGroup != nil }

    func save(token: String) throws {
        guard let group = AppConfiguration.keychainAccessGroup else { throw WidgetDataError.invalidConfiguration }
        let base = query(group: group)
        SecItemDelete(base as CFDictionary)
        var attributes = base
        attributes[kSecValueData as String] = Data(token.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
    }

    func load() throws -> String? {
        guard let group = AppConfiguration.keychainAccessGroup else { return nil }
        var values = query(group: group)
        values[kSecReturnData as String] = true
        values[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(values as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
        return String(data: data, encoding: .utf8)
    }

    func delete() {
        guard let group = AppConfiguration.keychainAccessGroup else { return }
        SecItemDelete(query(group: group) as CFDictionary)
    }

    private func query(group: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: group,
        ]
    }
}
