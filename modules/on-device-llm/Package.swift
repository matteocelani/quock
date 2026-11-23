// swift-tools-version: 6.2
// macOS benchmark host for the on-device engine: it compiles the module's own engine sources, so a measurement on the
// Mac exercises the same code the app ships. Not part of the app build (CocoaPods only reads ios/).
import PackageDescription

let engineSources = [
  "ios/AppMemory.swift",
  "ios/BodyQuantizer.swift",
  "ios/ForegroundGate.swift",
  "ios/HeadQuantizer.swift",
  "ios/LocalEngine.swift",
  "ios/LocalModelStore.swift",
  "ios/OllamaCatalog.swift",
  "ios/OllamaRegistry.swift",
  "ios/TokenizerBridge.swift",
]

let package = Package(
  name: "OnDeviceLLMBench",
  platforms: [.macOS(.v14)],
  dependencies: [
    .package(url: "https://github.com/ml-explore/mlx-swift", exact: "0.33.0"),
    .package(url: "https://github.com/ml-explore/mlx-swift-lm", exact: "3.33.0"),
    .package(url: "https://github.com/huggingface/swift-transformers", exact: "1.4.0"),
  ],
  targets: [
    .executableTarget(
      name: "quock-llm-bench",
      dependencies: [
        .product(name: "MLX", package: "mlx-swift"),
        .product(name: "MLXNN", package: "mlx-swift"),
        .product(name: "MLXLLM", package: "mlx-swift-lm"),
        .product(name: "MLXLMCommon", package: "mlx-swift-lm"),
        .product(name: "Tokenizers", package: "swift-transformers"),
      ],
      path: ".",
      sources: engineSources + ["bench/main.swift"],
      swiftSettings: [.swiftLanguageMode(.v5)]
    )
  ]
)
