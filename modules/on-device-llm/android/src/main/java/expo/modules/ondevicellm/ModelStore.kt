package expo.modules.ondevicellm

import android.app.DownloadManager
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.StatFs
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import org.json.JSONArray
import org.json.JSONObject

internal data class InstalledModel(
  val reference: String,
  val bytes: Long,
  val installedAt: Long,
  val capabilities: List<String>,
  val manifestDigest: String?,
)

internal class InsufficientSpaceException(val needed: Long, val free: Long) :
  Exception("Not enough storage: ${needed shr 20} MB needed, ${free shr 20} MB free.")

// Models live in the app's own storage folder, which no other app can read and which goes away with the app. The
// download itself is handed to the system's DownloadManager, so it carries on while the app is closed and resumes
// after a dropped connection by itself.
internal class ModelStore(private val context: Context) {
  private val downloads get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  val root: File get() = File(context.getExternalFilesDir(null) ?: context.filesDir, "OnDeviceLLM/models")

  fun directory(ref: ModelRef) = File(root, "${ref.namespace}/${ref.name}/${ref.tag}")

  fun weights(ref: ModelRef) = File(directory(ref), WEIGHTS_NAME)

  fun installed(ref: ModelRef): InstalledModel? = readMarker(File(directory(ref), MARKER_NAME))

  fun list(): List<InstalledModel> =
    root.walkTopDown().filter { it.name == MARKER_NAME }.mapNotNull { readMarker(it) }.toList()

  suspend fun remove(ref: ModelRef) = withContext(Dispatchers.IO) {
    val directory = directory(ref)
    readPullRecord(directory)?.let { downloads.remove(it) }
    directory.deleteRecursively()
    Unit
  }

  fun freeBytes(): Long = StatFs(root.apply { mkdirs() }.path).availableBytes

  // Fetches the GGUF into place and verifies it against the registry's digest. An interrupted pull is picked up by
  // the system download that is still running or finished; only a model never started begins again.
  suspend fun pull(ref: ModelRef, onProgress: (completed: Long, total: Long) -> Unit): InstalledModel {
    installed(ref)?.let { return it }
    val manifest = withContext(Dispatchers.IO) { OllamaRegistry.manifest(ref) }
    val layer = manifest.modelLayer ?: throw RegistryException("${ref.display} has no model file.")
    val directory = directory(ref).apply { mkdirs() }
    val partial = File(directory, "$WEIGHTS_NAME.part")

    var id = readPullRecord(directory)?.takeIf { isTracked(it) }
    if (id == null) {
      val free = freeBytes()
      // The file is verified in place, so only the download itself has to fit; a margin covers the filesystem.
      if (free < layer.size + SPACE_MARGIN) throw InsufficientSpaceException(layer.size + SPACE_MARGIN, free)
      partial.delete()
      val request = DownloadManager.Request(Uri.parse(OllamaRegistry.blobUrl(ref, layer.digest)))
        .setTitle(ref.display)
        .setDescription("Quock on-device model")
        .setDestinationUri(Uri.fromFile(partial))
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(true)
      id = downloads.enqueue(request)
      File(directory, PULL_NAME).writeText(id.toString())
    }

    onProgress(0, layer.size)
    while (true) {
      kotlin.coroutines.coroutineContext.ensureActive()
      when (val state = query(id!!)) {
        null -> throw RegistryException("The download was cancelled.")
        is Download.Running -> onProgress(state.written.coerceAtMost(layer.size), layer.size)
        is Download.Failed -> {
          downloads.remove(id)
          File(directory, PULL_NAME).delete()
          partial.delete()
          throw RegistryException("The download failed (${state.reason}). Try again.")
        }
        is Download.Done -> break
      }
      delay(PROGRESS_POLL_MS)
    }

    withContext(Dispatchers.IO) {
      val actual = sha256(partial)
      if ("sha256:$actual" != layer.digest) {
        downloads.remove(id!!)
        partial.delete()
        File(directory, PULL_NAME).delete()
        throw RegistryException("A downloaded file did not match its checksum.")
      }
      val weights = File(directory, WEIGHTS_NAME)
      weights.delete()
      if (!partial.renameTo(weights)) throw RegistryException("The model file could not be put in place.")
      downloads.remove(id!!)
      File(directory, PULL_NAME).delete()
    }
    onProgress(layer.size, layer.size)

    val capabilities = capabilities(ref, manifest)
    val model = InstalledModel(ref.display, layer.size, System.currentTimeMillis(), capabilities, manifest.digest)
    File(directory, MARKER_NAME).writeText(
      JSONObject()
        .put("reference", model.reference).put("bytes", model.bytes).put("installedAt", model.installedAt)
        .put("capabilities", JSONArray(model.capabilities)).put("manifestDigest", model.manifestDigest)
        .put("format", FORMAT).toString(),
    )
    return model
  }

  // Detected from the model's own config; "thinking" is what turns the reasoning toggle on in the UI.
  suspend fun capabilities(ref: ModelRef, manifest: Manifest): List<String> = withContext(Dispatchers.IO) {
    val result = mutableListOf("completion")
    val digest = manifest.configDigest ?: return@withContext result
    runCatching {
      val config = JSONObject(String(OllamaRegistry.blob(ref, digest)))
      val declared = config.optJSONArray("capabilities")
      if (declared != null && (0 until declared.length()).any { declared.getString(it) == "thinking" }) {
        result.add("thinking")
      }
    }
    result
  }

  private sealed interface Download {
    data class Running(val written: Long) : Download
    data class Failed(val reason: Int) : Download
    data object Done : Download
  }

  private fun isTracked(id: Long): Boolean = query(id) != null

  private fun query(id: Long): Download? {
    val cursor: Cursor = downloads.query(DownloadManager.Query().setFilterById(id)) ?: return null
    cursor.use {
      if (!it.moveToFirst()) return null
      val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      return when (status) {
        DownloadManager.STATUS_SUCCESSFUL -> Download.Done
        DownloadManager.STATUS_FAILED -> Download.Failed(it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))
        else -> Download.Running(it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)))
      }
    }
  }

  private fun readPullRecord(directory: File): Long? =
    runCatching { File(directory, PULL_NAME).readText().trim().toLong() }.getOrNull()

  private fun readMarker(file: File): InstalledModel? = runCatching {
    val json = JSONObject(file.readText())
    val capabilities = json.optJSONArray("capabilities")
    InstalledModel(
      reference = json.getString("reference"),
      bytes = json.getLong("bytes"),
      installedAt = json.getLong("installedAt"),
      capabilities = if (capabilities == null) listOf("completion") else (0 until capabilities.length()).map { capabilities.getString(it) },
      manifestDigest = json.optString("manifestDigest").takeIf { it.isNotEmpty() },
    )
  }.getOrNull()

  companion object {
    const val FORMAT = "gguf"
    const val WEIGHTS_NAME = "model.gguf"
    private const val MARKER_NAME = "quock-installed.json"
    private const val PULL_NAME = "quock-pull.json"
    private const val SPACE_MARGIN = 256L shl 20
    private const val PROGRESS_POLL_MS = 400L

    fun sha256(file: File): String {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().use { input ->
        val buffer = ByteArray(1 shl 20)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          digest.update(buffer, 0, read)
        }
      }
      return digest.digest().joinToString("") { "%02x".format(it) }
    }
  }
}
