import ExpoModulesCore
import WidgetKit

// The write half of the widget bridge, from the app's side.
//
// AsyncStorage lives in the app's own sandbox and the widget extension is a
// separate process, so it cannot be read from there. The shared App Group
// container is the only channel between the two, and reaching it needs native
// code — hence this module. See utils/sharedStorage.ts for the caller and
// targets/widget/index.swift for the reader; all three must agree on these two
// constants.
private let appGroup    = "group.io.dattl.app"
private let snapshotKey = "dattl_widget_snapshot"

public class DattlWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DattlWidgetBridge")

    Function("setSnapshot") { (json: String) in
      guard let defaults = UserDefaults(suiteName: appGroup) else { return }
      defaults.set(json, forKey: snapshotKey)

      // Without this the widget would keep rendering the previous snapshot until
      // its next scheduled entry, which can be up to a day out. The timeline
      // still covers the passage of time on its own; this covers data changes.
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
