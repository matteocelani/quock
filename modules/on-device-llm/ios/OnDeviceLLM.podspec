Pod::Spec.new do |s|
  s.name           = 'OnDeviceLLM'
  s.version        = '0.0.1'
  s.summary        = 'Runs Ollama registry models on device with Apple MLX.'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Matteo Celani'
  s.homepage       = 'https://github.com/matteocelani/quock'
  s.platforms      = {
    :ios => '17.0'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/matteocelani/quock.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"

  # MLX ships only as a Swift package; React Native's helper wires SPM products into this pod's target.
  spm_dependency(s,
    url: 'https://github.com/ml-explore/mlx-swift',
    requirement: { kind: 'exactVersion', version: '0.33.0' },
    products: ['MLX', 'MLXNN']
  )
  spm_dependency(s,
    url: 'https://github.com/ml-explore/mlx-swift-lm',
    requirement: { kind: 'exactVersion', version: '3.33.0' },
    products: ['MLXLLM', 'MLXLMCommon']
  )
  # Reads the tokenizer.json and Jinja chat template that ship inside each Ollama MLX build.
  spm_dependency(s,
    url: 'https://github.com/huggingface/swift-transformers',
    requirement: { kind: 'exactVersion', version: '1.4.0' },
    products: ['Tokenizers']
  )
end
