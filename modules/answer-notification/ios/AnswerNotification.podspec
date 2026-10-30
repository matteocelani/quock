Pod::Spec.new do |s|
  s.name           = 'AnswerNotification'
  s.version        = '1.0.0'
  s.summary        = "Tells the user an answer finished while the app was in the background."
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
