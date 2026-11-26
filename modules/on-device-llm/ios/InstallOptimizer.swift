import Foundation
import MLX

// What happens to a model between download and first load, chosen by the benchmark loop (bench/EXPERIMENTS.md):
// from a full-precision Ollama build, the linear layers become affine 6-bit (group 64) and the tied embedding /
// LM head affine 8-bit (group 128). Against the BF16 build on the macOS bench, 2b: 221 vs 188 tok/s for the mxfp8
// build, 1.76 vs 2.06 GB, KL 0.0088 vs 0.0108; 0.8b: 380 vs 335 tok/s, 0.82 vs 0.95 GB, KL 0.020 vs 0.018.
enum InstallOptimizer {
  static let headBits = 8
  static let headGroupSize = 128
  static let bodyBits = 6
  static let bodyGroupSize = 64
  static let installCacheLimit = 64 << 20

  private static let fullPrecisionFileTypes: Set<String> = ["", "bf16", "f16", "fp16", "f32"]

  // Ollama's config blob names a build's weight format; full-precision builds leave it empty.
  static func isFullPrecision(fileType: String?) -> Bool {
    fullPrecisionFileTypes.contains((fileType ?? "").lowercased())
  }

  // What an install has finished so far, kept on disk: a process killed mid-install (the user closes the app, iOS
  // reclaims it) resumes from here instead of downloading 9 GB again or quantizing a finished file a second time.
  struct State: Codable {
    static let fileName = "quock-optimize.json"
    var isFullPrecision: Bool
    var bodyDone: Set<String> = []
    var headDone = false
    var flashDone = false
    var flashBytes: Int64 = 0

    @discardableResult
    static func begin(in directory: URL, isFullPrecision: Bool) -> State {
      let state = State(isFullPrecision: isFullPrecision)
      state.save(in: directory)
      return state
    }

    static func load(in directory: URL) -> State? {
      (try? Data(contentsOf: directory.appending(path: fileName))).flatMap { try? JSONDecoder().decode(State.self, from: $0) }
    }

    func save(in directory: URL) {
      try? JSONEncoder().encode(self).write(to: directory.appending(path: Self.fileName), options: .atomic)
    }

    static func clear(in directory: URL) {
      try? FileManager.default.removeItem(at: directory.appending(path: fileName))
    }
  }

  // Runs the whole install on a directory that is not tracked, as the benchmark does with copies of a model.
  @discardableResult
  static func optimize(directory: URL, isFullPrecision: Bool) throws -> Int64 {
    var state = State.begin(in: directory, isFullPrecision: isFullPrecision)
    defer { State.clear(in: directory) }
    return try optimize(directory: directory, isFullPrecision: isFullPrecision, state: &state)
  }

  // Returns the bytes left on flash (read per token, never resident). Each finished step is recorded in `state`.
  @discardableResult
  static func optimize(directory: URL, isFullPrecision: Bool, state: inout State) throws -> Int64 {
    // Each tensor is quantized and written once, so recycled buffers buy nothing; uncapped, MLX's cache kept 1.8 GB
    // after a 2B install on the iPhone, close to the app's limit for a larger model and held until the next load.
    let previousLimit = Memory.cacheLimit
    Memory.cacheLimit = installCacheLimit
    defer {
      Memory.cacheLimit = previousLimit
      Memory.clearCache()
    }
    if isFullPrecision {
      var progress = state
      defer { state = progress }
      _ = try BodyQuantizer.quantize(
        directory: directory,
        plan: .init(bits: bodyBits, groupSize: bodyGroupSize, sensitive: [], sensitiveBits: bodyBits),
        skipping: state.bodyDone,
        onFileDone: { name in
          progress.bodyDone.insert(name)
          progress.save(in: directory)
        })
    }
    if !state.headDone {
      _ = try HeadQuantizer.quantizeEmbedding(in: directory, bits: headBits, groupSize: headGroupSize)
      state.headDone = true
      state.save(in: directory)
    }
    if !state.flashDone {
      state.flashBytes = try FlashEmbeddings.prepare(in: directory)
      state.flashDone = true
      state.save(in: directory)
    }
    return state.flashBytes
  }

  // The bytes the model will hold in memory once optimized, from the manifest alone: decides before downloading
  // whether it can run on this phone. A per-layer embedding table stays on flash and counts for nothing here.
  static func estimatedBytes(of layers: [OllamaLayer], isFullPrecision: Bool) -> Int64 {
    layers.reduce(Int64(0)) { total, layer in
      let name = layer.name ?? ""
      if name.hasSuffix("embed_tokens_per_layer.weight") { return total }
      if name.hasSuffix(HeadQuantizer.embeddingSuffix) {
        return total + scaled(layer.size, bits: headBits, groupSize: headGroupSize)
      }
      if isFullPrecision, BodyQuantizer.isLinearWeight(name) {
        return total + scaled(layer.size, bits: bodyBits, groupSize: bodyGroupSize)
      }
      return total + layer.size
    }
  }

  // A BF16 tensor of `size` bytes as affine `bits` with a float16 scale and bias per group.
  private static func scaled(_ size: Int64, bits: Int, groupSize: Int) -> Int64 {
    Int64(Double(size) * (Double(bits) + 32.0 / Double(groupSize)) / 16.0)
  }
}
