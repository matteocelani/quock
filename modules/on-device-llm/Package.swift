// swift-tools-version: 6.2
// macOS host for the on-device engine: a library built from the module's own engine sources, the benchmark that
// measures it, and the unit tests that guard it. Not part of the app build (CocoaPods only reads ios/*.podspec).
import PackageDescription

let mlx: [Target.Dependency] = [
  .product(name: "MLX", package: "mlx-swift"),
  .product(name: "MLXNN", package: "mlx-swift"),
  .product(name: "MLXLLM", package: "mlx-swift-lm"),
  .product(name: "MLXLMCommon", package: "mlx-swift-lm"),
  .product(name: "Tokenizers", package: "swift-transformers"),
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
    .target(
      name: "OnDeviceLLMCore",
      dependencies: mlx,
      path: "ios",
      exclude: ["OnDeviceLLMModule.swift", "SpikeSelfTest.swift", "OnDeviceLLM.podspec"],
      // The bench reaches the engine's internal API in Release too, so it measures the code the app ships.
      swiftSettings: [.swiftLanguageMode(.v5), .unsafeFlags(["-enable-testing"])]
    ),
    .executableTarget(
      name: "quock-llm-bench",
      dependencies: ["OnDeviceLLMCore", .product(name: "MLXVLM", package: "mlx-swift-lm")] + mlx,
      path: "bench",
      exclude: ["baselines.json", "results.jsonl", "EXPERIMENTS.md"],
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
    .testTarget(
      name: "OnDeviceLLMTests",
      dependencies: ["OnDeviceLLMCore"] + mlx,
      path: "tests",
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
  ]
)
