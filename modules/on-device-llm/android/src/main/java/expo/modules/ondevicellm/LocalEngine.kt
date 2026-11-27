package expo.modules.ondevicellm

import android.content.Context
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

internal data class LocalTurn(val role: String, val content: String)

internal sealed interface LocalEvent {
  data class Content(val text: String) : LocalEvent
  data class Thinking(val text: String) : LocalEvent
}

internal class LocalStats(
  val result: NativeEngine.Result,
  val stopReason: String,
  val peakMemoryBytes: Long,
) {
  fun dictionary(events: Int): Map<String, Any> = mapOf(
    "promptTokens" to result.promptTokens,
    "generatedTokens" to result.generatedTokens,
    "promptSeconds" to result.promptSeconds,
    "generateSeconds" to result.generateSeconds,
    "tokensPerSecond" to if (result.generateSeconds > 0) result.generatedTokens / result.generateSeconds else 0.0,
    "loadSeconds" to result.loadSeconds,
    "peakMemoryBytes" to peakMemoryBytes,
    "stopReason" to stopReason,
    "events" to events,
    "prefilledTokens" to result.prefilledTokens,
    "reusedTokens" to result.reusedTokens,
    "firstTokenSeconds" to result.firstTokenSeconds,
  )
}

internal class InsufficientMemoryException(val needed: Long, val available: Long) :
  Exception("Not enough free memory to run this model (${needed shr 20} MB needed, ${available shr 20} MB free).")

// Holds the one model that is loaded and runs replies on it, one at a time. A different model replaces it.
internal class LocalEngine(private val context: Context, private val store: ModelStore) {
  private val lock = Mutex()
  private var loaded: Pair<ModelRef, NativeEngine>? = null
  private val running = ConcurrentHashMap<String, NativeEngine>()

  suspend fun prepare(ref: ModelRef): Boolean = lock.withLock {
    if (store.installed(ref) == null) return false
    withContext(Dispatchers.Default) { engine(ref) }
    true
  }

  suspend fun unload() = lock.withLock { release() }

  fun cancel(requestId: String) {
    running[requestId]?.cancel()
  }

  fun cancelAll() = running.values.forEach { it.cancel() }

  suspend fun generate(
    requestId: String,
    ref: ModelRef,
    turns: List<LocalTurn>,
    think: Boolean?,
    maxTokens: Int,
    onEvent: (LocalEvent) -> Unit,
  ): LocalStats = lock.withLock {
    withContext(Dispatchers.Default) {
      val engine = engine(ref)
      running[requestId] = engine
      try {
        var lowMemory = false
        val result = engine.generate(
          turns.map { it.role to it.content }, if (think == null) -1 else if (think) 1 else 0, maxTokens,
        ) { thinking, bytes ->
          if (DeviceMemory.isLow(context)) {
            lowMemory = true
            return@generate false
          }
          val text = String(bytes, Charsets.UTF_8)
          onEvent(if (thinking) LocalEvent.Thinking(text) else LocalEvent.Content(text))
          true
        }
        LocalStats(result, if (lowMemory) "lowMemory" else "complete", engine.modelBytes + DeviceMemory.KV_ALLOWANCE_BYTES)
      } finally {
        running.remove(requestId)
      }
    }
  }

  private fun engine(ref: ModelRef): NativeEngine {
    loaded?.let { (current, engine) -> if (current == ref) return engine }
    release()
    val weights = store.weights(ref)
    val needed = (store.installed(ref)?.bytes ?: weights.length()) + DeviceMemory.KV_ALLOWANCE_BYTES
    val available = DeviceMemory.availableBytes(context)
    // Mapped weights count only as pages that can be dropped, so the check is against what a model may take of the
    // whole device, with what is free right now as the lower bound for the part that is not droppable.
    if (needed > DeviceMemory.budgetBytes(context) || DeviceMemory.KV_ALLOWANCE_BYTES * 2 > available) {
      throw InsufficientMemoryException(needed, available)
    }
    val engine = NativeEngine.load(context, weights.path, DeviceMemory.contextTokens(context), DeviceMemory.inferenceThreads())
    loaded = ref to engine
    return engine
  }

  private fun release() {
    loaded?.second?.close()
    loaded = null
  }
}
