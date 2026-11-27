package expo.modules.ondevicellm

import android.app.ActivityManager
import android.content.Context
import java.io.File

internal object DeviceMemory {
  // Weights are memory-mapped from flash, so most of them are pages the system can drop and reread; this share of RAM
  // is what a model may take before the whole device starts to stutter.
  private const val MODEL_SHARE = 0.55
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
  // own pace (measured on a Dimensity 7300, 4 fast + 4 slow cores: 8 threads 5 tok/s, 4 threads 8 tok/s). The kernel's
  // normalised cpu_capacity tells big from little where clock speed alone cannot (2.0 vs 2.5 GHz).
  private fun coreValues(name: String): List<Long> =
    (0 until Runtime.getRuntime().availableProcessors()).mapNotNull {
      runCatching { File("/sys/devices/system/cpu/cpu$it/$name").readText().trim().toLong() }.getOrNull()
    }

  // Set only by the debug self-test, to compare thread counts on a real phone.
  @Volatile var threadsOverride: Int? = null

  fun inferenceThreads(): Int {
    threadsOverride?.let { return it }
    val cores = Runtime.getRuntime().availableProcessors()
    val capacities = coreValues("cpu_capacity")
    if (capacities.size == cores) return capacities.count { it >= capacities.max() / 2 }.coerceIn(2, 8)
    val frequencies = coreValues("cpufreq/cpuinfo_max_freq")
    if (frequencies.size != cores) return (cores / 2).coerceIn(2, 4)
    return frequencies.count { it >= frequencies.max() * 7 / 10 }.coerceIn(2, 8)
  }
}
