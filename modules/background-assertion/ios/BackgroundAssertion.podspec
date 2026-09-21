Pod::Spec.new do |s|
  s.name           = 'BackgroundAssertion'
  s.version        = '1.0.0'
  s.summary        = "Extends the app's execution time so an in-flight answer can finish after backgrounding."
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Matteo Celani'
  s.homepage       = 'https://github.com/matteocelani/quock'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/matteocelani/quock.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
