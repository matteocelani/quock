import Foundation
import MLX
import XCTest

@testable import OnDeviceLLMCore

// Unit tests for the on-device engine. They run on the macOS host (`xcodebuild test`), build every input themselves
// (synthetic safetensors, configs, model directories) and need no network.

private func temporaryDirectory() throws -> URL {
  let url = FileManager.default.temporaryDirectory.appending(path: "quock-engine-tests-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  return url
}

// Writes a safetensors file by hand, so a test controls the exact header (key names, metadata) a registry blob has.
private func writeSafetensors(
  _ url: URL, tensors: [(name: String, dtype: String, shape: [Int], bytes: [UInt8])], metadata: [String: String]? = nil
) throws {
  var header: [String: Any] = [:]
  var offset = 0
  var data = Data()
  for tensor in tensors {
    header[tensor.name] = ["dtype": tensor.dtype, "shape": tensor.shape, "data_offsets": [offset, offset + tensor.bytes.count]]
    offset += tensor.bytes.count
    data.append(contentsOf: tensor.bytes)
  }
  if let metadata { header["__metadata__"] = metadata }
  var headerData = try JSONSerialization.data(withJSONObject: header, options: [.sortedKeys])
  headerData.append(contentsOf: [UInt8](repeating: 0x20, count: (8 - headerData.count % 8) % 8))
  var length = UInt64(headerData.count).littleEndian
  var file = Data(bytes: &length, count: 8)
  file.append(headerData)
  file.append(data)
  try file.write(to: url)
}

private func readHeader(_ url: URL) throws -> (header: [String: Any], headerLength: Int, data: Data) {
  let file = try Data(contentsOf: url)
  let length = file.prefix(8).withUnsafeBytes { $0.loadUnaligned(as: UInt64.self) }.littleEndian
  let header = try JSONSerialization.jsonObject(with: file.subdata(in: 8 ..< 8 + Int(length))) as! [String: Any]
  return (header, Int(length), file.subdata(in: 8 + Int(length) ..< file.count))
}

private func writeConfig(_ directory: URL, _ config: [String: Any]) throws {
  try JSONSerialization.data(withJSONObject: config).write(to: directory.appending(path: "config.json"))
}

private func readConfig(_ directory: URL) throws -> [String: Any] {
  try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appending(path: "config.json"))) as! [String: Any]
}

final class ModelReferenceTests: XCTestCase {
  func testParsesLibraryModelWithTag() throws {
    let ref = try ModelReference("qwen3.5:0.8b-mlx")
    XCTAssertEqual(ref.namespace, "library")
    XCTAssertEqual(ref.name, "qwen3.5")
    XCTAssertEqual(ref.tag, "0.8b-mlx")
    XCTAssertEqual(ref.display, "qwen3.5:0.8b-mlx")
  }

  func testDefaultsTagAndKeepsNamespace() throws {
    let ref = try ModelReference(" User/Model ")
    XCTAssertEqual(ref.namespace, "user")
    XCTAssertEqual(ref.name, "model")
    XCTAssertEqual(ref.tag, "latest")
    XCTAssertEqual(ref.display, "user/model:latest")
  }

  func testRejectsMalformedNames() {
    XCTAssertThrowsError(try ModelReference(""))
    XCTAssertThrowsError(try ModelReference("a/b/c:tag"))
    XCTAssertThrowsError(try ModelReference("a//b"))
  }
}

final class TensorHeaderTests: XCTestCase {
  func testRenamesOllamaScaleKeysAndKeepsTensorBytes() throws {
    let dir = try temporaryDirectory()
    let source = dir.appending(path: "blob")
    let destination = dir.appending(path: "model-00001.safetensors")
    let weight = [UInt8](0 ..< 16)
    let scale: [UInt8] = [7, 9]
    try writeSafetensors(
      source,
      tensors: [("layers.0.mlp.up_proj.weight", "U32", [2, 2], weight), ("layers.0.mlp.up_proj.weight.scale", "U8", [2, 1], scale)],
      metadata: ["quant_type": "mxfp8", "group_size": "32"])

    try OllamaRegistry.rewriteTensorHeader(from: source, to: destination)

    let (header, headerLength, data) = try readHeader(destination)
    XCTAssertNotNil(header["layers.0.mlp.up_proj.weight"])
    XCTAssertNotNil(header["layers.0.mlp.up_proj.scales"])
    XCTAssertNil(header["layers.0.mlp.up_proj.weight.scale"])
    XCTAssertEqual((header["__metadata__"] as? [String: String])?["quant_type"], "mxfp8")
    XCTAssertEqual(headerLength % 8, 0, "safetensors keeps the data section 8-byte aligned")
    XCTAssertEqual([UInt8](data), weight + scale, "only the header may change")
  }
}

final class QuantizationConfigTests: XCTestCase {
  func testMostCommonFormatIsDefaultAndOutliersGetPerLayerEntries() throws {
    let dir = try temporaryDirectory()
    let mx = ["quant_type": "mxfp8", "group_size": "32"]
    for (index, name) in ["model.language_model.layers.0.mlp.up_proj", "model.language_model.layers.0.mlp.gate_proj"]
      .enumerated()
    {
      try writeSafetensors(
        dir.appending(path: "model-\(index).safetensors"), tensors: [(name + ".weight", "U32", [1, 1], [0, 0, 0, 0])],
        metadata: mx)
    }
    try writeSafetensors(
      dir.appending(path: "model-9.safetensors"),
      tensors: [("model.language_model.layers.0.mlp.down_proj.weight", "U32", [1, 1], [0, 0, 0, 0])],
      metadata: ["quant_type": "nvfp4", "group_size": "16"])

    let config = try XCTUnwrap(try OllamaRegistry.quantization(ofTensorsIn: dir))

    XCTAssertEqual(config["mode"] as? String, "mxfp8")
    XCTAssertEqual(config["bits"] as? Int, 8)
    XCTAssertEqual(config["group_size"] as? Int, 32)
    let outlier = try XCTUnwrap(config["language_model.model.layers.0.mlp.down_proj"] as? [String: Any])
    XCTAssertEqual(outlier["mode"] as? String, "nvfp4")
    XCTAssertEqual(outlier["bits"] as? Int, 4)
    XCTAssertNil(config["language_model.model.layers.0.mlp.up_proj"], "tensors matching the default need no entry")
  }

  func testReturnsNilForUnquantizedBuilds() throws {
    let dir = try temporaryDirectory()
    try writeSafetensors(dir.appending(path: "model-0.safetensors"), tensors: [("w.weight", "BF16", [1, 2], [0, 0, 0, 0])])
    XCTAssertNil(try OllamaRegistry.quantization(ofTensorsIn: dir))
  }
}

final class HeadQuantizerTests: XCTestCase {
  func testQuantizesTiedEmbeddingAndRecordsPerLayerEntry() throws {
    let dir = try temporaryDirectory()
    try writeConfig(dir, ["quantization": ["group_size": 32, "bits": 8, "mode": "mxfp8"]])
    let embedding = MLXRandom.normal([512, 256]).asType(.bfloat16)
    let file = dir.appending(path: "model-00001.safetensors")
    try save(arrays: ["model.language_model.embed_tokens.weight": embedding], url: file)

    let outcome = try XCTUnwrap(try HeadQuantizer.quantizeEmbedding(in: dir, bits: 8, groupSize: 128))

    XCTAssertEqual(outcome.modulePath, "language_model.model.embed_tokens")
    XCTAssertLessThan(outcome.bytesAfter, outcome.bytesBefore * 6 / 10, "8-bit + scales must be well under BF16")
    let arrays = try loadArrays(url: file)
    let packed = try XCTUnwrap(arrays["model.language_model.embed_tokens.weight"])
    let scales = try XCTUnwrap(arrays["model.language_model.embed_tokens.scales"])
    let biases = try XCTUnwrap(arrays["model.language_model.embed_tokens.biases"])
    XCTAssertEqual(packed.dtype, .uint32)
    let restored = dequantized(packed, scales: scales, biases: biases, groupSize: 128, bits: 8)
    let maxError = abs(restored.asType(.float32) - embedding.asType(.float32)).max().item(Float.self)
    XCTAssertLessThan(maxError, 0.05, "8-bit affine must reconstruct a unit-normal matrix closely")

    let quantization = try XCTUnwrap(try readConfig(dir)["quantization"] as? [String: Any])
    let entry = try XCTUnwrap(quantization["language_model.model.embed_tokens"] as? [String: Any])
    XCTAssertEqual(entry["bits"] as? Int, 8)
    XCTAssertEqual(entry["group_size"] as? Int, 128)
    XCTAssertEqual(entry["mode"] as? String, "affine")
    XCTAssertEqual(quantization["mode"] as? String, "mxfp8", "the body's default must survive")

    XCTAssertNil(try HeadQuantizer.quantizeEmbedding(in: dir, bits: 8, groupSize: 128), "a second pass is a no-op")
  }

  func testInstalledBytesShrinksOnlyTheEmbedding() {
    let layers = [
      OllamaLayer(mediaType: "t", digest: "a", size: 1600, name: "model.language_model.embed_tokens.weight"),
      OllamaLayer(mediaType: "t", digest: "b", size: 1000, name: "model.language_model.layers.0.mlp.up_proj.weight"),
    ]
    // 8 bits per weight plus a float16 scale and bias per 128 weights: 8.25 / 16 of the BF16 size.
    XCTAssertEqual(HeadQuantizer.installedBytes(of: layers, bits: 8, groupSize: 128), 825 + 1000)
  }

  func testModulePathMapsHuggingFaceLayout() {
    XCTAssertEqual(
      HeadQuantizer.modulePath(forCheckpointKey: "model.language_model.layers.3.mlp.down_proj"),
      "language_model.model.layers.3.mlp.down_proj")
    XCTAssertEqual(
      HeadQuantizer.modulePath(forCheckpointKey: "language_model.model.embed_tokens"), "language_model.model.embed_tokens")
  }
}

final class BodyQuantizerTests: XCTestCase {
  func testQuantizesLinearLayersKeepsSensitiveOnesWiderAndSkipsNorms() throws {
    let dir = try temporaryDirectory()
    try writeConfig(dir, ["model_type": "qwen3_5"])
    let up = "model.language_model.layers.0.mlp.up_proj.weight"
    let down = "model.language_model.layers.0.mlp.down_proj.weight"
    let norm = "model.language_model.layers.0.input_layernorm.weight"
    try save(arrays: [up: MLXRandom.normal([128, 256]).asType(.bfloat16)], url: dir.appending(path: "model-1.safetensors"))
    try save(arrays: [down: MLXRandom.normal([128, 256]).asType(.bfloat16)], url: dir.appending(path: "model-2.safetensors"))
    try save(arrays: [norm: MLXArray.ones([256]).asType(.bfloat16)], url: dir.appending(path: "model-3.safetensors"))

    let outcome = try BodyQuantizer.quantize(
      directory: dir, plan: .init(bits: 4, groupSize: 64, sensitive: ["mlp.down_proj"], sensitiveBits: 8))

    XCTAssertEqual(outcome.tensors, 2, "the norm vector is not a linear layer")
    let quantization = try XCTUnwrap(try readConfig(dir)["quantization"] as? [String: Any])
    XCTAssertEqual(quantization["bits"] as? Int, 4)
    XCTAssertEqual(quantization["mode"] as? String, "affine")
    XCTAssertEqual((quantization["language_model.model.layers.0.mlp.down_proj"] as? [String: Any])?["bits"] as? Int, 8)
    XCTAssertNil(quantization["language_model.model.layers.0.mlp.up_proj"], "default-width layers need no entry")
    XCTAssertNotNil(try loadArrays(url: dir.appending(path: "model-1.safetensors"))[up.replacingOccurrences(of: ".weight", with: ".scales")])
    XCTAssertEqual(try loadArrays(url: dir.appending(path: "model-3.safetensors"))[norm]?.dtype, .bfloat16)
  }
}

final class FileIntegrityTests: XCTestCase {
  override func setUp() {
    setenv("QUOCK_LLM_MODELS_DIR", FileManager.default.temporaryDirectory.appending(path: "quock-engine-tests-store").path, 1)
  }

  private func installedDirectory() throws -> (ModelReference, URL) {
    let ref = try ModelReference("test/model:\(UUID().uuidString.prefix(8).lowercased())")
    let dir = LocalModelStore.directory(for: ref)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    try Data("weights".utf8).write(to: dir.appending(path: "model-00001.safetensors"))
    try Data("{}".utf8).write(to: dir.appending(path: "config.json"))
    try LocalModelStore.recordFileHashes(in: dir)
    return (ref, dir)
  }

  func testUntouchedFilesVerify() throws {
    let (ref, _) = try installedDirectory()
    XCTAssertNoThrow(try LocalModelStore.verifyFiles(of: ref))
  }

  func testChangedFileIsRejected() throws {
    let (ref, dir) = try installedDirectory()
    try Data("weightz".utf8).write(to: dir.appending(path: "model-00001.safetensors"))
    XCTAssertThrowsError(try LocalModelStore.verifyFiles(of: ref))
  }

  func testMissingOrExtraFilesAreRejected() throws {
    let (ref, dir) = try installedDirectory()
    try Data("x".utf8).write(to: dir.appending(path: "model-00002.safetensors"))
    XCTAssertThrowsError(try LocalModelStore.verifyFiles(of: ref))
    try FileManager.default.removeItem(at: dir.appending(path: "model-00002.safetensors"))
    try FileManager.default.removeItem(at: dir.appending(path: "config.json"))
    XCTAssertThrowsError(try LocalModelStore.verifyFiles(of: ref))
  }
}

final class AppMemoryTests: XCTestCase {
  func testLoadNeedsTheWeightsPlusOneGigabyteOfHeadroom() {
    XCTAssertEqual(AppMemory.neededToLoad(bytes: 100), 100 + (1 << 30))
    XCTAssertEqual(AppMemory.neededToLoad(bytes: -5), 1 << 30, "a corrupt negative size must not underflow")
  }
}
