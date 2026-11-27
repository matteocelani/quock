#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <vector>

struct llama_model;
struct llama_context;
struct llama_sampler;

namespace quock {

struct Turn {
  std::string role;
  std::string content;
};

enum class EventKind { Content, Thinking };

struct Stats {
  int promptTokens = 0;
  int generatedTokens = 0;
  int prefilledTokens = 0;
  int reusedTokens = 0;
  double loadSeconds = 0;
  double promptSeconds = 0;
  double generateSeconds = 0;
  double firstTokenSeconds = 0;
  // "complete", "length", "cancelled", or "contextFull".
  std::string stopReason = "complete";
};

// One loaded GGUF model with its context. Calls are serialised by the caller; `cancel` is the only thing meant to be
// touched from another thread.
class Engine {
 public:
  struct Options {
    int contextTokens = 4096;
    int threads = 4;
    bool useMmap = true;
  };

  static std::unique_ptr<Engine> load(const std::string &path, const Options &options, std::string &error);
  ~Engine();

  // Streams text through `onEvent`; returning false from it stops the reply. `think` empty = the model's default.
  Stats generate(const std::vector<Turn> &turns, int think, int maxTokens,
                 const std::function<bool(EventKind, const std::string &)> &onEvent);

  void cancel() { cancelled_.store(true); }
  uint64_t modelBytes() const;
  bool supportsThinking() const { return supportsThinking_; }

 private:
  Engine() = default;

  struct Snapshot {
    std::vector<int32_t> tokens;
    std::vector<uint8_t> state;
  };

  bool decode(const std::vector<int32_t> &tokens, size_t from, size_t to, bool wantLogits);
  void restoreTo(const std::vector<int32_t> &prompt, int &reused);
  void snapshotPrompt(const std::vector<int32_t> &prompt);

  llama_model *model_ = nullptr;
  llama_context *ctx_ = nullptr;
  struct Templates;
  std::unique_ptr<Templates> templates_;
  std::vector<int32_t> cached_;
  Snapshot snapshot_;
  std::atomic<bool> cancelled_{false};
  bool supportsThinking_ = false;
  int batchSize_ = 512;
  int contextTokens_ = 0;
  bool canTrim_ = true;
  double loadSeconds_ = 0;
};

}  // namespace quock
