import CryptoKit
import Foundation

// Digests of installed model files, computed on every core. A file is split into fixed chunks hashed independently,
// and its digest is the SHA-256 of its size and its chunk digests in order, so a changed byte, a truncation or a
// reordering all change it. One whole-file SHA-256 of Gemma 4's 6.5 GB took 2.4 s on a single core before every first
// load; split, the same check spreads over all of them.
enum FileDigest {
  static let prefix = "sha256-chunks64m:"
  static let chunkBytes = 64 << 20
  private static let readBytes = 4 << 20

  static func digests(of files: [URL], chunkBytes: Int = chunkBytes) throws -> [String] {
    var descriptors: [Int32] = []
    defer { descriptors.forEach { close($0) } }
    var sizes: [Int] = []
    for file in files {
      let descriptor = open(file.path(percentEncoded: false), O_RDONLY)
      guard descriptor >= 0 else { throw CocoaError(.fileReadNoSuchFile, userInfo: [NSURLErrorKey: file]) }
      descriptors.append(descriptor)
      var info = stat()
      guard fstat(descriptor, &info) == 0 else { throw CocoaError(.fileReadUnknown, userInfo: [NSURLErrorKey: file]) }
      sizes.append(Int(info.st_size))
    }

    // Every chunk of every file is one work item, so a single large file still uses every core.
    var items: [(file: Int, offset: Int, length: Int)] = []
    for (index, size) in sizes.enumerated() {
      var offset = 0
      repeat {
        let length = min(chunkBytes, size - offset)
        items.append((index, offset, length))
        offset += chunkBytes
      } while offset < size
    }

    let results = ChunkResults(count: items.count)
    DispatchQueue.concurrentPerform(iterations: items.count) { position in
      let item = items[position]
      let buffer = UnsafeMutableRawPointer.allocate(byteCount: readBytes, alignment: 16)
      defer { buffer.deallocate() }
      var hasher = SHA256()
      var done = 0
      while done < item.length {
        let read = pread(descriptors[item.file], buffer, min(readBytes, item.length - done), off_t(item.offset + done))
        guard read > 0 else { return results.fail() }
        hasher.update(bufferPointer: UnsafeRawBufferPointer(start: buffer, count: read))
        done += read
      }
      results.set(position, Data(hasher.finalize()))
    }
    guard let chunks = results.values else { throw CocoaError(.fileReadUnknown) }

    var output: [String] = []
    var cursor = 0
    for size in sizes {
      var hasher = SHA256()
      withUnsafeBytes(of: UInt64(size).littleEndian) { hasher.update(bufferPointer: $0) }
      repeat {
        hasher.update(data: chunks[cursor])
        cursor += 1
      } while cursor < items.count && items[cursor].offset != 0
      output.append(prefix + hasher.finalize().map { String(format: "%02x", $0) }.joined())
    }
    return output
  }
}

private final class ChunkResults: @unchecked Sendable {
  private let lock = NSLock()
  private var digests: [Data?]
  private var failed = false

  init(count: Int) { digests = Array(repeating: nil, count: count) }

  func set(_ index: Int, _ digest: Data) {
    lock.lock()
    digests[index] = digest
    lock.unlock()
  }

  func fail() {
    lock.lock()
    failed = true
    lock.unlock()
  }

  var values: [Data]? {
    lock.lock()
    defer { lock.unlock() }
    let values = digests.compactMap { $0 }
    return failed || values.count != digests.count ? nil : values
  }
}
