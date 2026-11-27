package expo.modules.ondevicellm

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// Device harness for debuggable builds only: a file `selftest.txt` in the app's private files folder (written with
// `adb shell run-as <package>`, since the app cannot read files adb creates elsewhere) holding a model name makes
// the app pull it, run a three-turn chat and log to logcat (tag QuockSelfTest) with no UI.
internal object SelfTest {
  private const val TAG = "QuockSelfTest"

  fun runIfRequested(context: Context, store: ModelStore, engine: LocalEngine) {
    if (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return
    // A harness must never stop the app from starting, so an unreadable request is simply ignored.
    var keep = false
    val model = try {
      val request = File(context.filesDir, "selftest.txt")
      if (!request.exists()) return
      val lines = request.readLines().map { it.trim() }.filter { it.isNotEmpty() }
      request.delete()
      // Optional extra lines: `threads=N` to override the thread count, `keep` to leave the model installed.
      lines.drop(1).forEach { line ->
        if (line == "keep") keep = true
        if (line.startsWith("threads=")) DeviceMemory.threadsOverride = line.removePrefix("threads=").toIntOrNull()
      }
      lines.first()
    } catch (error: Exception) {
      Log.w(TAG, "self-test request ignored: $error")
      return
    }
    CoroutineScope(Dispatchers.Default).launch {
      try {
        val ref = ModelRef.parse(model)
        Log.i(TAG, "start $model free=${store.freeBytes() shr 20}MB ram=${DeviceMemory.totalBytes(context) shr 20}MB threads=${DeviceMemory.inferenceThreads()}")
        var lastDecile = -1
        val started = System.nanoTime()
        val installed = store.pull(ref) { done, total ->
          val decile = if (total > 0) (done * 10 / total).toInt() else 0
          if (decile != lastDecile) {
            lastDecile = decile
            Log.i(TAG, "pull ${done shr 20}/${total shr 20} MB")
          }
        }
        Log.i(TAG, "installed ${installed.bytes shr 20} MB caps=${installed.capabilities} in ${(System.nanoTime() - started) / 1e9}s")
        val history = mutableListOf<LocalTurn>()
        for ((index, message) in listOf("Mi consigli un libro di fantascienza?", "Perché proprio quello?", "Riassumi in una frase.").withIndex()) {
          history.add(LocalTurn("user", message))
          val answer = StringBuilder()
          val stats = engine.generate("selftest", ref, history, false, 120) { event ->
            if (event is LocalEvent.Content) answer.append(event.text)
          }
          history.add(LocalTurn("assistant", answer.toString()))
          val r = stats.result
          Log.i(TAG, "turn ${index + 1} prompt=${r.promptTokens} prefilled=${r.prefilledTokens} reused=${r.reusedTokens} ttft=${"%.2f".format(r.firstTokenSeconds)}s tok/s=${"%.1f".format(if (r.generateSeconds > 0) r.generatedTokens / r.generateSeconds else 0.0)} stop=${stats.stopReason}")
          Log.i(TAG, "answer: ${answer.toString().take(300).replace('\n', ' ')}")
        }
        engine.unload()
        val first = System.nanoTime()
        engine.prepare(ref)
        Log.i(TAG, "reload ${(System.nanoTime() - first) / 1e9}s")
        engine.unload()
        if (!keep) store.remove(ref)
        Log.i(TAG, "DONE")
      } catch (error: Throwable) {
        Log.e(TAG, "FAILED: $error", error)
      }
    }
  }
}
