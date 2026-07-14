/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'DattlWidget',
  displayName: 'Dattl',

  // Resolves against the app's bundle id → io.dattl.app.DattlWidget.
  // This is a separate bundle, so it needs its own App ID in the developer
  // portal with the App Group capability enabled — the app's App ID is not
  // enough.
  bundleIdentifier: '.DattlWidget',

  // .containerBackground(_:for:) is iOS 17+, and iOS 17 requires widgets to
  // declare one, so there is no reason to support anything older.
  deploymentTarget: '17.0',

  // The only channel between the app and the widget: both processes open this
  // App Group's UserDefaults suite. Must match APP_GROUP in
  // utils/sharedStorage.ts, ios.entitlements in app.json, and Shared.appGroup
  // in ./index.swift.
  entitlements: {
    'com.apple.security.application-groups': ['group.io.dattl.app'],
  },
};
