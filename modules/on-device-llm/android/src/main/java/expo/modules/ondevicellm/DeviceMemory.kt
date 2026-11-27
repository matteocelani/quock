package expo.modules.ondevicellm

import android.app.ActivityManager
import android.content.Context
import java.io.File

internal object DeviceMemory {
  // Weights are memory-mapped from flash, so most of them are pages the system can drop and reread; this share of RAM
  // is what a model may take before the whole device starts to stutter.
  private const val MODEL_SHARE = 0.45
  const val KV_ALLOWANCE_BYTES = 384L shl 20

  private fun info(context: Context): ActivityManager.MemoryInfo {
    val info = ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
    return info
  }

  fun totalBytes(context: Context): Long = info(context).totalMem

  fun availableBytes(context: Context): Long = info(context).availMem

  fun isLow(context: Context): Boolean = info(context).lowMemory

  fun budgetBytes(context: Context): Long = (totalBytes(context) * MODEL_SHARE).toLong()

  fun contextTokens(context: Context): Int = if (totalBytes(context) >= (7L shl 30)) 8192 else 4096

  // Threads that run on the performance cores: a phone's slow cores drag a parallel matrix multiply down to their
  // own pace, so using every core is slower than using only the fast ones.
  fun inferenceThreads(): Int {
    val frequencies = (0 until Runtime.getRuntime().availableProcessors()).mapNotNull {
      runCatching { File("/sys/devices/system/cpu/cpu$it/cpufreq/cpuinfo_max_freq").readText().trim().toLong() }.getOrNull()
    }
    if (frequencies.isEmpty()) return (Runtime.getRuntime().availableProcessors() / 2).coerceIn(2, 4)
    val top = frequencies.max()
    return frequencies.count { it >= top * 0.7 }.coerceIn(2, 8)
  }
}
