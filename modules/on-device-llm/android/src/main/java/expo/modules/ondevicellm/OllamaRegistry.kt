package expo.modules.ondevicellm

import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

internal class RegistryException(message: String) : Exception(message)

internal data class ModelRef(val namespace: String, val name: String, val tag: String) {
  val display: String get() = if (namespace == "library") "$name:$tag" else "$namespace/$name:$tag"

  companion object {
    // Same grammar `ollama pull` accepts: [namespace/]name[:tag], tag defaulting to latest.
    fun parse(raw: String): ModelRef {
      val trimmed = raw.trim().lowercase()
      val colon = trimmed.indexOf(':')
      val path = if (colon < 0) trimmed else trimmed.substring(0, colon)
      val tag = if (colon < 0 || colon == trimmed.length - 1) "latest" else trimmed.substring(colon + 1)
      val segments = path.split("/")
      if (path.isEmpty() || segments.size > 2 || segments.any { it.isEmpty() }) {
        throw RegistryException("$raw is not a valid model name.")
      }
      return if (segments.size == 2) ModelRef(segments[0], segments[1], tag) else ModelRef("library", segments[0], tag)
    }
  }
}

internal data class Layer(val mediaType: String, val digest: String, val size: Long)

internal data class Manifest(val digest: String, val configDigest: String?, val layers: List<Layer>) {
  // The GGUF weights: the only layer a text model needs (the projector is the vision tower, the draft a speculative
  // decoder this engine does not use).
  val modelLayer: Layer? get() = layers.firstOrNull { it.mediaType == OllamaRegistry.MODEL_MEDIA_TYPE }
}

internal object OllamaRegistry {
  const val MODEL_MEDIA_TYPE = "application/vnd.ollama.image.model"
  private const val HOST = "https://registry.ollama.ai"
  private const val ACCEPT = "application/vnd.docker.distribution.manifest.v2+json"

  fun blobUrl(ref: ModelRef, digest: String): String = "$HOST/v2/${ref.namespace}/${ref.name}/blobs/$digest"

  fun manifest(ref: ModelRef): Manifest {
    val body = get("$HOST/v2/${ref.namespace}/${ref.name}/manifests/${ref.tag}", ACCEPT)
    val json = JSONObject(String(body))
    val layers = json.optJSONArray("layers") ?: throw RegistryException("${ref.display} has no downloadable build.")
    return Manifest(
      digest = sha256Hex(body),
      configDigest = json.optJSONObject("config")?.optString("digest")?.takeIf { it.isNotEmpty() },
      layers = (0 until layers.length()).map {
        val layer = layers.getJSONObject(it)
        Layer(layer.getString("mediaType"), layer.getString("digest"), layer.getLong("size"))
      },
    )
  }

  fun blob(ref: ModelRef, digest: String): ByteArray = get(blobUrl(ref, digest), null)

  private fun get(url: String, accept: String?): ByteArray {
    val connection = URL(url).openConnection() as HttpURLConnection
    try {
      connection.connectTimeout = 15_000
      connection.readTimeout = 30_000
      connection.instanceFollowRedirects = true
      if (accept != null) connection.setRequestProperty("Accept", accept)
      val status = connection.responseCode
      if (status != 200) throw RegistryException("The model registry answered $status.")
      return connection.inputStream.use { it.readBytes() }
    } finally {
      connection.disconnect()
    }
  }

  fun sha256Hex(bytes: ByteArray): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
}
