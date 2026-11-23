import Darwin
import Foundation
import Metal
import os

// What iOS lets this process use, as opposed to how much RAM the phone has: without the increased-memory-limit
// entitlement an 8 GB iPhone gives an app well under half of it.
enum AppMemory {
  // Runtime, activations and KV cache beside the weights. Measured on an iPhone 16 Pro Max: a 2.3 GB model with 3.1 GB
  // free loaded and answered once, then a thinking reply drove free memory under 700 MB and jetsam killed the app.
  private static let loadHeadroomBytes: UInt64 = 1 << 30
  // Below this, generation stops with what it has rather than letting iOS kill the app mid-reply.
  static let generationFloorBytes: UInt64 = 256 << 20

  static var available: UInt64 {
    #if os(iOS)
      let limit = UInt64(os_proc_available_memory())
      // An iPad app running on a Mac has no per-process limit, and the call answers 0: without this every load would
      // be refused there.
      if limit > 0 { return limit }
    #endif
    return gpuWorkingSetAvailable
  }

  // Where no process limit exists (macOS, iPad apps on a Mac), the GPU's recommended working set is the real ceiling
  // for weights that MLX keeps resident; what this process already holds is subtracted.
  private static var gpuWorkingSetAvailable: UInt64 {
    let ceiling = MTLCreateSystemDefaultDevice()?.recommendedMaxWorkingSetSize ?? ProcessInfo.processInfo.physicalMemory
    return ceiling - min(footprint, ceiling)
  }

  static var footprint: UInt64 {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return result == KERN_SUCCESS ? info.phys_footprint : 0
  }

  static func neededToLoad(bytes: Int64) -> UInt64 {
    UInt64(max(bytes, 0)) + loadHeadroomBytes
  }
}
