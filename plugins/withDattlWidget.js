const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const APP_GROUP        = 'group.io.dattl.app';
const WIDGET_NAME      = 'DattlWidget';
const WIDGET_BUNDLE_ID = 'io.dattl.app.DattlWidget';
const WIDGET_DEPLOY    = '17.0';

// ─── File templates ────────────────────────────────────────────────────────────

const WIDGET_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>`;

const WIDGET_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>`;

// Written to ios/Dattl/ — compiled into the main app target
const SHARED_STORAGE_SWIFT = `import Foundation
import React

@objc(DattlSharedStorage)
class DattlSharedStorage: NSObject {

  @objc(writeItems:)
  func writeItems(_ json: String) {
    guard let defaults = UserDefaults(suiteName: "${APP_GROUP}") else { return }
    defaults.set(json, forKey: "dattl_widget_items")
    defaults.synchronize()
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}
`;

const SHARED_STORAGE_OBJC = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DattlSharedStorage, NSObject)
RCT_EXTERN_METHOD(writeItems:(NSString *)json)
@end
`;

// ─── Plugin ────────────────────────────────────────────────────────────────────

module.exports = function withDattlWidget(config) {
  // 1. App Group on main app
  config = withEntitlementsPlist(config, c => {
    const groups = c.modResults['com.apple.security.application-groups'] ?? [];
    if (!groups.includes(APP_GROUP)) {
      c.modResults['com.apple.security.application-groups'] = [...groups, APP_GROUP];
    }
    return c;
  });

  // 2. Xcode project
  config = withXcodeProject(config, c => {
    const proj    = c.modResults;
    const iosRoot = c.modRequest.platformProjectRoot; // .../ios
    const projName = c.modRequest.projectName;        // Dattl

    // ── Write native bridge files ──────────────────────────────────────────────
    const appDir = path.join(iosRoot, projName);
    writeIfMissing(path.join(appDir, 'DattlSharedStorage.swift'), SHARED_STORAGE_SWIFT);
    writeIfMissing(path.join(appDir, 'DattlSharedStorage.m'),     SHARED_STORAGE_OBJC);

    // ── Write widget files ─────────────────────────────────────────────────────
    const widgetDir = path.join(iosRoot, WIDGET_NAME);
    fs.mkdirSync(widgetDir, { recursive: true });
    writeIfMissing(path.join(widgetDir, `${WIDGET_NAME}.swift`),                   widgetSwiftSource());
    writeIfMissing(path.join(widgetDir, 'Info.plist'),                             WIDGET_INFO_PLIST);
    writeIfMissing(path.join(widgetDir, `${WIDGET_NAME}Extension.entitlements`),   WIDGET_ENTITLEMENTS);

    // ── Idempotency check ──────────────────────────────────────────────────────
    const targets = proj.pbxNativeTargetSection();
    const exists  = Object.values(targets).some(
      t => t && typeof t === 'object' && t.name === `"${WIDGET_NAME}"`
    );
    if (exists) {
      console.log('[withDattlWidget] Widget target already present — skipping.');
      return c;
    }

    // ── Add widget extension target ────────────────────────────────────────────
    const widgetTarget = proj.addTarget(WIDGET_NAME, 'app_extension', WIDGET_NAME, WIDGET_BUNDLE_ID);
    const wtUuid = widgetTarget.uuid;

    // Add files to a PBX group
    const widgetGroupUuid = proj.addPbxGroup(
      [`${WIDGET_NAME}.swift`, 'Info.plist', `${WIDGET_NAME}Extension.entitlements`],
      WIDGET_NAME,
      WIDGET_NAME
    ).uuid;
    // Attach group to the project's main group
    proj.addToPbxGroup(widgetGroupUuid, proj.getFirstProject().firstProject.mainGroup);

    // Build phases for the widget target
    proj.addBuildPhase([`${WIDGET_NAME}/${WIDGET_NAME}.swift`],
      'PBXSourcesBuildPhase', 'Sources', wtUuid);
    proj.addBuildPhase([`${WIDGET_NAME}/Info.plist`],
      'PBXResourcesBuildPhase', 'Resources', wtUuid);
    proj.addBuildPhase([],
      'PBXFrameworksBuildPhase', 'Frameworks', wtUuid);

    // Build settings on both configurations
    for (const build of ['Debug', 'Release']) {
      proj.updateBuildProperty('INFOPLIST_FILE',
        `"${WIDGET_NAME}/Info.plist"`, build, WIDGET_NAME);
      proj.updateBuildProperty('PRODUCT_BUNDLE_IDENTIFIER',
        `"${WIDGET_BUNDLE_ID}"`, build, WIDGET_NAME);
      proj.updateBuildProperty('CODE_SIGN_ENTITLEMENTS',
        `"${WIDGET_NAME}/${WIDGET_NAME}Extension.entitlements"`, build, WIDGET_NAME);
      proj.updateBuildProperty('IPHONEOS_DEPLOYMENT_TARGET', WIDGET_DEPLOY, build, WIDGET_NAME);
      proj.updateBuildProperty('SWIFT_VERSION', '"5.0"', build, WIDGET_NAME);
      proj.updateBuildProperty('TARGETED_DEVICE_FAMILY', '"1"', build, WIDGET_NAME);
      proj.updateBuildProperty('SKIP_INSTALL', 'YES', build, WIDGET_NAME);
      proj.updateBuildProperty('APPLICATION_EXTENSION_API_ONLY', 'YES', build, WIDGET_NAME);
      proj.updateBuildProperty('GENERATE_INFOPLIST_FILE', 'NO', build, WIDGET_NAME);
      proj.updateBuildProperty('MARKETING_VERSION', '"1.0"', build, WIDGET_NAME);
      proj.updateBuildProperty('CURRENT_PROJECT_VERSION', '1', build, WIDGET_NAME);
    }

    // ── Embed the widget extension in the main app ─────────────────────────────
    const mainTarget = proj.getFirstTarget();
    const mtUuid     = mainTarget.uuid;

    // Build file referencing the widget's product
    const buildFileUuid = proj.generateUuid();
    proj.pbxBuildFileSection()[buildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: widgetTarget.pbxNativeTarget.productReference,
      fileRef_comment: `${WIDGET_NAME}.appex`,
      settings: '{ ATTRIBUTES = (RemoveHeadersOnCopy, ); }',
    };
    proj.pbxBuildFileSection()[`${buildFileUuid}_comment`] =
      `${WIDGET_NAME}.appex in Embed Foundation Extensions`;

    // Add a CopyFiles phase to the main target
    const embedUuid = proj.generateUuid();
    proj.pbxCopyfilesBuildPhaseObj(embedUuid); // initialises the section entry
    const embedPhase = {
      isa: 'PBXCopyFilesBuildPhase',
      buildActionMask: 2147483647,
      dstPath: '""',
      dstSubfolderSpec: 13,
      files: [{ value: buildFileUuid, comment: `${WIDGET_NAME}.appex in Embed Foundation Extensions` }],
      name: '"Embed Foundation Extensions"',
      runOnlyForDeploymentPostprocessing: 0,
    };
    proj.pbxCopyfilesBuildPhaseSection()[embedUuid]              = embedPhase;
    proj.pbxCopyfilesBuildPhaseSection()[`${embedUuid}_comment`] = 'Embed Foundation Extensions';

    // Attach the embed phase to the main target's buildPhases array
    const mainNativeTarget = proj.pbxNativeTargetSection()[mtUuid];
    mainNativeTarget.buildPhases.push({ value: embedUuid, comment: 'Embed Foundation Extensions' });

    // ── Add DattlSharedStorage files to main app ───────────────────────────────
    const appGroupKey = proj.findPBXGroupKey({ name: projName });
    if (appGroupKey) {
      proj.addSourceFile(`${projName}/DattlSharedStorage.swift`, { target: mtUuid }, appGroupKey);
      proj.addSourceFile(`${projName}/DattlSharedStorage.m`,     { target: mtUuid }, appGroupKey);
    }

    return c;
  });

  return config;
};

// ─── Util ──────────────────────────────────────────────────────────────────────

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

// ─── Widget Swift source (returned by function to keep the string readable) ────

function widgetSwiftSource() {
  return `import WidgetKit
import SwiftUI

// MARK: - Model

struct WidgetItem: Codable {
    let id: String
    let name: String
    let expiryDate: String
}

struct ExpiryEntry: TimelineEntry {
    let date: Date
    let rows: [ExpiryRow]
}

struct ExpiryRow: Identifiable {
    let id: String
    let name: String
    let daysLeft: Int
}

// MARK: - Data

private func parseDays(_ iso: String) -> Int? {
    var fmt = ISO8601DateFormatter()
    fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var d = fmt.date(from: iso)
    if d == nil {
        fmt.formatOptions = [.withInternetDateTime]
        d = fmt.date(from: iso)
    }
    guard let date = d else { return nil }
    let today  = Calendar.current.startOfDay(for: Date())
    let expiry = Calendar.current.startOfDay(for: date)
    return Calendar.current.dateComponents([.day], from: today, to: expiry).day
}

private func loadRows(max: Int) -> [ExpiryRow] {
    guard
        let defaults = UserDefaults(suiteName: "${APP_GROUP}"),
        let json  = defaults.string(forKey: "dattl_widget_items"),
        let data  = json.data(using: .utf8),
        let items = try? JSONDecoder().decode([WidgetItem].self, from: data)
    else { return [] }

    return items
        .compactMap { i -> ExpiryRow? in
            guard let d = parseDays(i.expiryDate) else { return nil }
            return ExpiryRow(id: i.id, name: i.name, daysLeft: d)
        }
        .filter  { $0.daysLeft >= -3 }
        .sorted  { $0.daysLeft < $1.daysLeft }
        .prefix(max)
        .map { $0 }
}

// MARK: - Provider

struct DattlProvider: TimelineProvider {
    func placeholder(in context: Context) -> ExpiryEntry {
        ExpiryEntry(date: Date(), rows: [
            ExpiryRow(id: "a", name: "Mascara", daysLeft:  1),
            ExpiryRow(id: "b", name: "Milch",   daysLeft:  0),
            ExpiryRow(id: "c", name: "Topfen",  daysLeft: -1),
        ])
    }
    func getSnapshot(in context: Context, completion: @escaping (ExpiryEntry) -> Void) {
        completion(ExpiryEntry(date: Date(), rows: loadRows(max: 3)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ExpiryEntry>) -> Void) {
        let entry   = ExpiryEntry(date: Date(), rows: loadRows(max: 3))
        let refresh = Date(timeIntervalSinceNow: 30 * 60) // refresh every 30 min
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

// MARK: - Chip

struct DaysChip: View {
    let days: Int
    private var label: String {
        switch days {
        case ..<0:  return "\\(abs(days))d ago"
        case 0:     return "today"
        case 1:     return "tomorrow"
        default:    return "in \\(days)d"
        }
    }
    private var fg: Color { days < 0 ? .white : days <= 2 ? .black : Color(white: 0.55) }
    private var bg: Color {
        if days < 0  { return Color(red: 0.88, green: 0.32, blue: 0.32) }
        if days <= 2 { return Color(red: 0.96, green: 0.77, blue: 0.26) }
        return Color(white: 0.14)
    }
    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .foregroundColor(fg)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(bg).cornerRadius(20)
    }
}

// MARK: - Row

struct RowView: View {
    let row: ExpiryRow
    var body: some View {
        HStack {
            Text(row.name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white).lineLimit(1)
            Spacer(minLength: 4)
            DaysChip(days: row.daysLeft)
        }
    }
}

// MARK: - Entry View

struct DattlEntryView: View {
    @Environment(\\.widgetFamily) var family
    let entry: ExpiryEntry
    private var maxRows: Int { family == .systemSmall ? 2 : 3 }
    private let accent = Color(red: 0.851, green: 0.467, blue: 0.024)
    private let bg     = Color(red: 0.059, green: 0.059, blue: 0.059)

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("Dattl")
                    .font(.system(size: family == .systemSmall ? 12 : 13, weight: .black))
                    .foregroundColor(accent)
                if family != .systemSmall {
                    Spacer()
                    Text("Expiring soon")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(Color(white: 0.45))
                }
            }
            .padding(.bottom, 10)

            if entry.rows.isEmpty {
                Spacer()
                Text("Nothing expires soon. Nice.")
                    .font(.system(size: 12))
                    .foregroundColor(Color(white: 0.45))
                    .frame(maxWidth: .infinity,
                           alignment: family == .systemSmall ? .leading : .center)
                Spacer()
            } else {
                let visible = Array(entry.rows.prefix(maxRows))
                VStack(alignment: .leading, spacing: 7) {
                    ForEach(Array(visible.enumerated()), id: \\.offset) { idx, row in
                        RowView(row: row)
                        if idx < visible.count - 1 {
                            Rectangle().fill(Color(white: 0.11)).frame(height: 0.5)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(family == .systemSmall ? 14 : 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(bg, for: .widget)
    }
}

// MARK: - Widget

@main
struct DattlWidget: Widget {
    let kind = "DattlWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DattlProvider()) { entry in
            DattlEntryView(entry: entry)
        }
        .configurationDisplayName("Dattl")
        .description("Your next items expiring soon.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
`;
}
