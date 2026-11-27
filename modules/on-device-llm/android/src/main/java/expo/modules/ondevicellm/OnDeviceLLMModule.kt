package expo.modules.ondevicellm

import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

class OnDeviceLLMModule : Module() {
  private val context get() = appContext.reactContext ?: throw CodedException("No application context.")
  private val store by lazy { ModelStore(context) }
  private val engine by lazy { LocalEngine(context, store) }

  override fun definition() = ModuleDefinition {
    Name("OnDeviceLLM")

    Events("onPullProgress", "onGenerateEvent")

    OnCreate { SelfTest.runIfRequested(context, store, engine) }

    OnDestroy { engine.cancelAll() }

    // The CPU kernels are built for 64-bit ARM (x86_64 for the emulator), and a model needs room to run beside the
    // system; below 4 GB the cloud path serves the chat better.
    Function("isSupported") {
      val abis = Build.SUPPORTED_ABIS.toSet()
      (abis.contains("arm64-v8a") || abis.contains("x86_64")) && DeviceMemory.totalBytes(context) >= (3500L shl 20)
    }

    Function("listInstalled") {
      store.list().map {
        mapOf(
          "model" to it.reference, "bytes" to it.bytes, "installedAt" to it.installedAt,
          "capabilities" to it.capabilities,
        )
      }
    }

    AsyncFunction("catalog") Coroutine { models: List<String> ->
      coroutineScope {
        models.mapNotNull { runCatching { ModelRef.parse(it) }.getOrNull() }.map { ref ->
          async {
            runCatching {
              val manifest = OllamaRegistry.manifest(ref)
              val layer = manifest.modelLayer ?: return@runCatching null
              // Offered only when this phone could run it: weights plus the cache they need beside them.
              if (layer.size + DeviceMemory.KV_ALLOWANCE_BYTES > DeviceMemory.budgetBytes(context)) return@runCatching null
              mapOf("model" to ref.display, "bytes" to layer.size, "capabilities" to store.capabilities(ref, manifest))
            }.getOrNull()
          }
        }.awaitAll().filterNotNull().sortedBy { it["bytes"] as Long }
      }
    }

    AsyncFunction("pull") Coroutine { model: String ->
      val ref = ModelRef.parse(model)
      val installed = store.pull(ref) { completed, total ->
        sendEvent("onPullProgress", mapOf("model" to ref.display, "completed" to completed, "total" to total))
      }
      mapOf("model" to installed.reference, "bytes" to installed.bytes)
    }

    AsyncFunction("remove") Coroutine { model: String ->
      val ref = ModelRef.parse(model)
      // A reply in flight holds the model's files open; stop it before they go.
      engine.cancelAll()
      engine.unload()
      store.remove(ref)
    }

    AsyncFunction("prepare") Coroutine { model: String -> engine.prepare(ModelRef.parse(model)) }

    AsyncFunction("unload") Coroutine { -> engine.unload() }

    AsyncFunction("generate") Coroutine { requestId: String, model: String, messages: List<Map<String, String>>, think: Boolean?, maxTokens: Int ->
      val ref = ModelRef.parse(model)
      val turns = messages.map { LocalTurn(it["role"] ?: "user", it["content"] ?: "") }
      val events = AtomicInteger(0)
      val stats = engine.generate(requestId, ref, turns, think, maxTokens) { event ->
        events.incrementAndGet()
        val (kind, text) = when (event) {
          is LocalEvent.Content -> "content" to event.text
          is LocalEvent.Thinking -> "thinking" to event.text
        }
        sendEvent("onGenerateEvent", mapOf("requestId" to requestId, "kind" to kind, "text" to text))
      }
      // Events and this promise reach JS on different paths; the count lets the caller wait for the stragglers.
      stats.dictionary(events.get())
    }

    AsyncFunction("cancel") { requestId: String -> engine.cancel(requestId) }
  }
}
