package expo.modules.ondevicellm

import android.content.Context
import android.os.Build
import java.util.zip.ZipFile

// Thin JNI wrapper around one loaded GGUF model. Text crosses the boundary as UTF-8 bytes: JNI's own string format
// cannot carry every emoji.
internal class NativeEngine private constructor(private val handle: Long) {
  fun interface Sink {
    // `thinking` marks reasoning text; return false to stop the reply.
    fun onEvent(thinking: Boolean, text: ByteArray): Boolean
  }

  class Result(
    val promptTokens: Int,
    val generatedTokens: Int,
    val prefilledTokens: Int,
    val reusedTokens: Int,
    val stopReason: String,
    val loadSeconds: Double,
    val promptSeconds: Double,
    val generateSeconds: Double,
    val firstTokenSeconds: Double,
  )

  val modelBytes: Long get() = nativeModelBytes(handle)
  val supportsThinking: Boolean get() = nativeSupportsThinking(handle)

  fun cancel() = nativeCancel(handle)

  fun close() = nativeFree(handle)

  fun generate(
    turns: List<Pair<String, String>>,
    think: Int,
    maxTokens: Int,
    sink: Sink,
  ): Result {
    val seconds = DoubleArray(4)
    val out = nativeGenerate(
      handle,
      Array(turns.size) { turns[it].first.toByteArray() },
      Array(turns.size) { turns[it].second.toByteArray() },
      think, maxTokens, sink, seconds,
    )
    return Result(
      out[0].toInt(), out[1].toInt(), out[2].toInt(), out[3].toInt(), out[4],
      seconds[0], seconds[1], seconds[2], seconds[3],
    )
  }

  companion object {
    @Volatile private var initialised = false

    init {
      System.loadLibrary("quock_llm")
    }

    @Synchronized
    fun initialise(context: Context) {
      if (initialised) return
      nativeInit(cpuVariants(context).map { it.toByteArray() }.toTypedArray())
      initialised = true
    }

    fun load(context: Context, path: String, contextTokens: Int, threads: Int): NativeEngine {
      initialise(context)
      val handle = nativeLoad(path.toByteArray(), contextTokens, threads)
      if (handle == 0L) throw IllegalStateException(String(nativeLastError()).ifEmpty { "The model could not be loaded." })
      return NativeEngine(handle)
    }

    // The CPU kernel libraries packed for this device's ABI, by file name.
    private fun cpuVariants(context: Context): List<String> {
      val abi = Build.SUPPORTED_ABIS.firstOrNull { abi -> abi == "arm64-v8a" || abi == "x86_64" } ?: return emptyList()
      return ZipFile(context.applicationInfo.sourceDir).use { zip ->
        zip.entries().asSequence().map { it.name }
          .filter { it.startsWith("lib/$abi/libggml-cpu") && it.endsWith(".so") }
          .map { it.substringAfterLast('/') }.toList()
      }
    }

    @JvmStatic private external fun nativeInit(variants: Array<ByteArray>)
    @JvmStatic private external fun nativeLoad(path: ByteArray, contextTokens: Int, threads: Int): Long
    @JvmStatic private external fun nativeLastError(): ByteArray
    @JvmStatic private external fun nativeFree(handle: Long)
    @JvmStatic private external fun nativeCancel(handle: Long)
    @JvmStatic private external fun nativeModelBytes(handle: Long): Long
    @JvmStatic private external fun nativeSupportsThinking(handle: Long): Boolean
    @JvmStatic private external fun nativeGenerate(
      handle: Long, roles: Array<ByteArray>, contents: Array<ByteArray>, think: Int, maxTokens: Int,
      sink: Sink, seconds: DoubleArray,
    ): Array<String>
  }
}
