import Foundation

struct APIClient {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL = AppConfiguration.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func login(password: String) async throws -> String {
        guard baseURL.scheme == "https" else { throw WidgetDataError.insecureTransport }
        var request = URLRequest(url: baseURL.appending(path: "/api/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(LoginRequest(password: password))
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try JSONDecoder().decode(LoginResponse.self, from: data).token
    }

    func fetchToday(date: Date = Date(), token: String) async throws -> WidgetSnapshot {
        guard baseURL.scheme == "https" else { throw WidgetDataError.insecureTransport }
        let value = Self.dateFormatter.string(from: date)
        var components = URLComponents(url: baseURL.appending(path: "/api/widget/today"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "date", value: value)]
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try JSONDecoder().decode(WidgetSnapshot.self, from: data).sanitized()
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw WidgetDataError.invalidSnapshot }
        if http.statusCode == 401 || http.statusCode == 403 { throw WidgetDataError.unauthorized }
        guard (200..<300).contains(http.statusCode) else { throw WidgetDataError.server(http.statusCode) }
    }

    private struct LoginRequest: Encodable { let password: String }
    private struct LoginResponse: Decodable { let token: String }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
