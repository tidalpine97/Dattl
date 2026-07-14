Pod::Spec.new do |s|
  s.name           = 'DattlWidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Writes the Dattl widget snapshot into the shared App Group container.'
  s.description    = 'Local Expo module. Mirrors item data from JS into the App Group UserDefaults suite that the WidgetKit extension reads, and reloads the widget timeline when it changes.'
  s.author         = 'Dattl'
  s.homepage       = 'https://dattl.io'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # WidgetCenter (for reloadAllTimelines) lives here.
  s.frameworks = 'WidgetKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
