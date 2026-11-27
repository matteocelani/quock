#include <android/log.h>
#include <dlfcn.h>
#include <jni.h>

#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "engine.h"
#include "ggml-backend.h"
#include "llama.h"

namespace {

std::string lastError;

std::string toString(JNIEnv *env, jbyteArray bytes) {
  if (!bytes) return {};
  jsize length = env->GetArrayLength(bytes);
  std::string out((size_t)length, '\0');
  env->GetByteArrayRegion(bytes, 0, length, reinterpret_cast<jbyte *>(out.data()));
  return out;
}

jbyteArray toBytes(JNIEnv *env, const std::string &text) {
  jbyteArray array = env->NewByteArray((jsize)text.size());
  env->SetByteArrayRegion(array, 0, (jsize)text.size(), reinterpret_cast<const jbyte *>(text.data()));
  return array;
}

void forwardLogs(ggml_log_level level, const char *text, void *) {
  if (level < GGML_LOG_LEVEL_WARN) return;
  __android_log_print(level >= GGML_LOG_LEVEL_ERROR ? ANDROID_LOG_ERROR : ANDROID_LOG_WARN, "QuockLLM", "%s", text);
}

}  // namespace

extern "C" {

// The CPU kernels come in one library per feature level (armv8.0 up to armv9.2). They stay inside the APK, so they are
// opened by name rather than found by scanning a folder; each reports how well it suits this CPU (0 = cannot run) and
// the best one is registered.
JNIEXPORT void JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeInit(JNIEnv *env, jclass, jobjectArray names) {
  static std::once_flag once;
  std::call_once(once, [&] {
    llama_log_set(forwardLogs, nullptr);
    std::string best;
    int bestScore = 0;
    jsize count = env->GetArrayLength(names);
    for (jsize i = 0; i < count; i++) {
      auto bytes = (jbyteArray)env->GetObjectArrayElement(names, i);
      std::string name = toString(env, bytes);
      env->DeleteLocalRef(bytes);
      void *handle = dlopen(name.c_str(), RTLD_NOW | RTLD_LOCAL);
      if (!handle) continue;
      auto score = reinterpret_cast<int (*)()>(dlsym(handle, "ggml_backend_score"));
      int value = score ? score() : 0;
      dlclose(handle);
      __android_log_print(ANDROID_LOG_INFO, "QuockLLM", "cpu variant %s score %d", name.c_str(), value);
      if (value > bestScore) {
        bestScore = value;
        best = name;
      }
    }
    if (!best.empty()) {
      ggml_backend_load(best.c_str());
      __android_log_print(ANDROID_LOG_INFO, "QuockLLM", "using %s", best.c_str());
    }
    llama_backend_init();
  });
}

JNIEXPORT jlong JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeLoad(JNIEnv *env, jclass, jbyteArray path,
                                                                             jint contextTokens, jint threads) {
  quock::Engine::Options options;
  options.contextTokens = contextTokens;
  options.threads = threads;
  std::string error;
  auto engine = quock::Engine::load(toString(env, path), options, error);
  if (!engine) {
    lastError = error;
    return 0;
  }
  return reinterpret_cast<jlong>(engine.release());
}

JNIEXPORT jbyteArray JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeLastError(JNIEnv *env, jclass) {
  return toBytes(env, lastError);
}

JNIEXPORT void JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeFree(JNIEnv *, jclass, jlong handle) {
  delete reinterpret_cast<quock::Engine *>(handle);
}

JNIEXPORT void JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeCancel(JNIEnv *, jclass, jlong handle) {
  reinterpret_cast<quock::Engine *>(handle)->cancel();
}

JNIEXPORT jlong JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeModelBytes(JNIEnv *, jclass, jlong handle) {
  return (jlong)reinterpret_cast<quock::Engine *>(handle)->modelBytes();
}

JNIEXPORT jboolean JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeSupportsThinking(JNIEnv *, jclass,
                                                                                            jlong handle) {
  return reinterpret_cast<quock::Engine *>(handle)->supportsThinking();
}

// Returns {promptTokens, generatedTokens, prefilledTokens, reusedTokens} and fills `seconds` with
// {load, prompt, generate, firstToken}. `sink` receives (kind, utf8 bytes) and returns false to stop the reply.
JNIEXPORT jobjectArray JNICALL Java_expo_modules_ondevicellm_NativeEngine_nativeGenerate(
    JNIEnv *env, jclass, jlong handle, jobjectArray roles, jobjectArray contents, jint think, jint maxTokens,
    jobject sink, jdoubleArray seconds) {
  auto *engine = reinterpret_cast<quock::Engine *>(handle);
  std::vector<quock::Turn> turns;
  jsize count = env->GetArrayLength(roles);
  for (jsize i = 0; i < count; i++) {
    auto role = (jbyteArray)env->GetObjectArrayElement(roles, i);
    auto content = (jbyteArray)env->GetObjectArrayElement(contents, i);
    turns.push_back({toString(env, role), toString(env, content)});
    env->DeleteLocalRef(role);
    env->DeleteLocalRef(content);
  }
  jclass sinkClass = env->GetObjectClass(sink);
  jmethodID onEvent = env->GetMethodID(sinkClass, "onEvent", "(Z[B)Z");

  quock::Stats stats = engine->generate(turns, think, maxTokens, [&](quock::EventKind kind, const std::string &text) {
    jbyteArray bytes = toBytes(env, text);
    jboolean keepGoing = env->CallBooleanMethod(sink, onEvent, (jboolean)(kind == quock::EventKind::Thinking), bytes);
    env->DeleteLocalRef(bytes);
    return keepGoing == JNI_TRUE && !env->ExceptionCheck();
  });

  jdouble timings[4] = {stats.loadSeconds, stats.promptSeconds, stats.generateSeconds, stats.firstTokenSeconds};
  env->SetDoubleArrayRegion(seconds, 0, 4, timings);
  jclass stringClass = env->FindClass("java/lang/String");
  jobjectArray result = env->NewObjectArray(5, stringClass, nullptr);
  env->SetObjectArrayElement(result, 0, env->NewStringUTF(std::to_string(stats.promptTokens).c_str()));
  env->SetObjectArrayElement(result, 1, env->NewStringUTF(std::to_string(stats.generatedTokens).c_str()));
  env->SetObjectArrayElement(result, 2, env->NewStringUTF(std::to_string(stats.prefilledTokens).c_str()));
  env->SetObjectArrayElement(result, 3, env->NewStringUTF(std::to_string(stats.reusedTokens).c_str()));
  env->SetObjectArrayElement(result, 4, env->NewStringUTF(stats.stopReason.c_str()));
  return result;
}

}  // extern "C"
