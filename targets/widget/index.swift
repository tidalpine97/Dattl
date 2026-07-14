import SwiftUI
import WidgetKit

// ─────────────────────────────────────────────────────────────────────────────
// The read half of the widget bridge.
//
// This process has its own sandbox and cannot see the app's AsyncStorage, so
// everything below is rendered from a JSON snapshot the app writes into the
// shared App Group container. See utils/sharedStorage.ts for the write half —
// the two constants here are the contract between them.
// ─────────────────────────────────────────────────────────────────────────────

private enum Shared {
    static let appGroup    = "group.io.dattl.app"
    static let snapshotKey = "dattl_widget_snapshot"
}

/// Mirrored from constants/theme.ts. Widgets can't import the app's tokens, so
/// these are hand-copied; update both together.
private enum Palette {
    static let background = Color(red: 0.059, green: 0.059, blue: 0.059) // #0f0f0f
    static let surface    = Color(red: 0.122, green: 0.122, blue: 0.122) // #1f1f1f
    static let border     = Color(red: 0.165, green: 0.165, blue: 0.165) // #2a2a2a
    static let text       = Color(red: 0.910, green: 0.910, blue: 0.910) // #e8e8e8
    static let muted      = Color(red: 0.533, green: 0.533, blue: 0.533) // #888888
    static let accent     = Color(red: 0.851, green: 0.467, blue: 0.024) // #D97706
    static let warning    = Color(red: 0.961, green: 0.773, blue: 0.259) // #f5c542
    static let expired    = Color(red: 0.878, green: 0.322, blue: 0.322) // #E05252
}

// MARK: - Snapshot

private struct SnapshotItem: Decodable {
    let id: String
    let name: String
    let expiry: String // local calendar day, "yyyy-MM-dd"
}

private struct Snapshot: Decodable {
    let v: Int
    let lang: String
    let items: [SnapshotItem]
}

/// Fixed-format parser for the snapshot's date-only strings. The POSIX locale
/// keeps it immune to the device's calendar and region settings; the current
/// time zone is what turns "2026-07-18" into that day's local midnight.
private let dayParser: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar   = Calendar(identifier: .gregorian)
    formatter.locale     = Locale(identifier: "en_US_POSIX")
    formatter.timeZone   = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
}()

// MARK: - Entry

struct ExpiringItem: Identifiable {
    let id: String
    let name: String
    let daysLeft: Int
}

struct DattlEntry: TimelineEntry {
    let date: Date
    let items: [ExpiringItem]
    let expiringThisWeek: Int
    let lang: String
    /// False when the app has never written a snapshot — a different empty state
    /// from "synced, but nothing is expiring", which is good news rather than a
    /// prompt to go open the app.
    let hasSnapshot: Bool
}

/// Builds the entry as it should look *on `date`*.
///
/// Days-remaining is derived here rather than shipped in the snapshot, so a
/// timeline entry scheduled for next Tuesday shows next Tuesday's numbers. That
/// is what lets the widget stay correct across midnight without the app ever
/// reopening.
private func makeEntry(for date: Date) -> DattlEntry {
    guard
        let defaults = UserDefaults(suiteName: Shared.appGroup),
        let json     = defaults.string(forKey: Shared.snapshotKey),
        let data     = json.data(using: .utf8),
        let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
    else {
        return DattlEntry(date: date, items: [], expiringThisWeek: 0, lang: "en", hasSnapshot: false)
    }

    let calendar = Calendar.current
    let today    = calendar.startOfDay(for: date)

    let ranked = snapshot.items
        .compactMap { item -> ExpiringItem? in
            guard
                let expiry = dayParser.date(from: item.expiry),
                let days   = calendar.dateComponents(
                    [.day], from: today, to: calendar.startOfDay(for: expiry)
                ).day
            else { return nil }
            return ExpiringItem(id: item.id, name: item.name, daysLeft: days)
        }
        // Recently-expired items stay visible: still in the fridge, still the
        // thing you most need to know about before shopping.
        .filter { $0.daysLeft >= -7 }
        .sorted { $0.daysLeft < $1.daysLeft }

    return DattlEntry(
        date:             date,
        items:            Array(ranked.prefix(5)),
        expiringThisWeek: ranked.filter { (0 ... 7).contains($0.daysLeft) }.count,
        lang:             snapshot.lang,
        hasSnapshot:      true
    )
}

// MARK: - Provider

struct DattlProvider: TimelineProvider {
    func placeholder(in _: Context) -> DattlEntry {
        DattlEntry(
            date: Date(),
            items: [
                ExpiringItem(id: "1", name: "Milch",   daysLeft: 0),
                ExpiringItem(id: "2", name: "Joghurt", daysLeft: 2),
                ExpiringItem(id: "3", name: "Mascara", daysLeft: 6),
            ],
            expiringThisWeek: 3,
            lang: "en",
            hasSnapshot: true
        )
    }

    func getSnapshot(in _: Context, completion: @escaping (DattlEntry) -> Void) {
        completion(makeEntry(for: Date()))
    }

    func getTimeline(in _: Context, completion: @escaping (Timeline<DattlEntry>) -> Void) {
        let calendar = Calendar.current
        let now      = Date()
        let today    = calendar.startOfDay(for: now)

        // One entry per local midnight for a week. WidgetKit swaps between them on
        // its own clock, so "in 3 days" ticks down to "in 2 days" unattended and
        // the app only has to force a reload when the data itself changes.
        var entries = [makeEntry(for: now)]
        for dayOffset in 1 ... 7 {
            guard let midnight = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
            entries.append(makeEntry(for: midnight))
        }

        let refresh = calendar.date(byAdding: .day, value: 7, to: today) ?? now.addingTimeInterval(86_400)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

// MARK: - Copy

private func daysLabel(_ days: Int, _ lang: String) -> String {
    let de = lang == "de"
    switch days {
    case ..<(-1): return de ? "vor \(abs(days)) Tagen" : "\(abs(days))d ago"
    case -1:      return de ? "gestern"                : "1d ago"
    case 0:       return de ? "heute"                  : "today"
    case 1:       return de ? "morgen"                 : "tomorrow"
    default:      return de ? "in \(days) Tagen"       : "in \(days)d"
    }
}

private func weekLabel(_ count: Int, _ lang: String) -> String {
    let de = lang == "de"
    switch count {
    case 0:  return de ? "nichts diese Woche" : "none this week"
    case 1:  return de ? "1 diese Woche"      : "1 this week"
    default: return de ? "\(count) diese Woche" : "\(count) this week"
    }
}

// MARK: - Views

private struct DaysChip: View {
    let days: Int
    let lang: String

    private var foreground: Color {
        if days < 0 { return .white }
        if days <= 2 { return .black }
        return Palette.muted
    }

    private var background: Color {
        if days < 0 { return Palette.expired }
        if days <= 2 { return Palette.warning }
        return Palette.surface
    }

    var body: some View {
        Text(daysLabel(days, lang))
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(foreground)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(background, in: Capsule())
    }
}

private struct ItemRow: View {
    let item: ExpiringItem
    let lang: String

    var body: some View {
        HStack(spacing: 6) {
            Text(item.name)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Palette.text)
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            Spacer(minLength: 4)

            DaysChip(days: item.daysLeft, lang: lang)
        }
        .padding(.vertical, 3)
    }
}

struct DattlEntryView: View {
    @Environment(\.widgetFamily) private var family

    let entry: DattlEntry

    private var maxRows: Int { family == .systemSmall ? 3 : 5 }

    private var emptyMessage: String {
        let de = entry.lang == "de"
        if !entry.hasSnapshot {
            return de ? "Dattl öffnen zum Synchronisieren" : "Open Dattl to sync"
        }
        return de ? "Nichts läuft bald ab." : "Nothing expiring soon."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("Dattl")
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(Palette.accent)

                Spacer(minLength: 0)

                if entry.hasSnapshot {
                    Text(weekLabel(entry.expiringThisWeek, entry.lang))
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Palette.muted)
                        .lineLimit(1)
                }
            }

            if entry.items.isEmpty {
                Spacer(minLength: 0)
                Text(emptyMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.muted)
                    .lineLimit(2)
                Spacer(minLength: 0)
            } else {
                let rows = Array(entry.items.prefix(maxRows))
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, item in
                        ItemRow(item: item, lang: entry.lang)
                        if index < rows.count - 1 {
                            Rectangle()
                                .fill(Palette.border)
                                .frame(height: 0.5)
                        }
                    }
                }
                .padding(.top, 4)

                Spacer(minLength: 0)
            }
        }
        .containerBackground(Palette.background, for: .widget)
        // Opens the app on the items tab — expo-router maps "/" to app/(tabs)/index.
        .widgetURL(URL(string: "dattl:///"))
    }
}

// MARK: - Widget

@main
struct DattlWidget: Widget {
    private let kind = "DattlWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DattlProvider()) { entry in
            DattlEntryView(entry: entry)
        }
        .configurationDisplayName("Dattl")
        .description("What's about to expire.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
