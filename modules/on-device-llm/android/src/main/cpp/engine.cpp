#include "engine.h"

#include <algorithm>
#include <chrono>
#include <cstring>

#include "chat.h"
#include "llama.h"

namespace quock {

namespace {

using Clock = std::chrono::steady_clock;

double secondsSince(Clock::time_point start) {
  return std::chrono::duration<double>(Clock::now() - start).count();
}

std::vector<llama_token> tokenize(const llama_vocab *vocab, const std::string &text) {
  int count = -llama_tokenize(vocab, text.c_str(), (int32_t)text.size(), nullptr, 0, false, true);
  if (count <= 0) return {};
  std::vector<llama_token> tokens(count);
  int written = llama_tokenize(vocab, text.c_str(), (int32_t)text.size(), tokens.data(), count, false, true);
  if (written < 0) return {};
  tokens.resize(written);
  return tokens;
}

std::string pieceOf(const llama_vocab *vocab, llama_token token) {
  char buffer[256];
  int n = llama_token_to_piece(vocab, token, buffer, sizeof(buffer), 0, false);
  if (n < 0) {
    std::string big(-n, '\0');
    n = llama_token_to_piece(vocab, token, big.data(), (int32_t)big.size(), 0, false);
    if (n < 0) return {};
    big.resize(n);
    return big;
  }
  return std::string(buffer, n);
}

// Length of the longest prefix of `text` that ends on a UTF-8 character boundary; a token can end mid-character.
size_t completeUtf8Length(const std::string &text) {
  size_t length = text.size();
  size_t back = 0;
  while (back < 4 && back < length) {
    unsigned char byte = (unsigned char)text[length - 1 - back];
    if ((byte & 0xC0) == 0x80) {
      back++;
      continue;
    }
    size_t needed = byte >= 0xF0 ? 4 : byte >= 0xE0 ? 3 : byte >= 0xC0 ? 2 : 1;
    return needed > back + 1 ? length - 1 - back : length;
  }
  return length;
}

common_chat_msg message(const std::string &role, const std::string &content) {
  common_chat_msg msg;
  msg.role = role;
  msg.content = content;
  return msg;
}

size_t commonPrefix(const std::vector<int32_t> &a, const std::vector<int32_t> &b) {
  size_t n = std::min(a.size(), b.size());
  size_t i = 0;
  while (i < n && a[i] == b[i]) i++;
  return i;
}

// Splits a stream into reasoning and answer using the model's own markers, holding back any text that could still turn
// into a marker once the next token arrives.
class ThinkingSplitter {
 public:
  ThinkingSplitter(bool startsInside, std::string startTag, std::vector<std::string> endTags)
      : inside_(startsInside), startTag_(std::move(startTag)), endTags_(std::move(endTags)) {}

  template <typename Emit>
  void feed(const std::string &text, Emit &&emit) {
    pending_ += text;
    drain(false, emit);
  }

  template <typename Emit>
  void finish(Emit &&emit) {
    drain(true, emit);
  }

 private:
  template <typename Emit>
  void drain(bool final, Emit &&emit) {
    while (!pending_.empty()) {
      const std::vector<std::string> targets = inside_ ? endTags_ : std::vector<std::string>{startTag_};
      size_t hit = std::string::npos;
      size_t hitLength = 0;
      for (const auto &tag : targets) {
        if (tag.empty()) continue;
        size_t at = pending_.find(tag);
        if (at != std::string::npos && at < hit) {
          hit = at;
          hitLength = tag.size();
        }
      }
      if (hit != std::string::npos) {
        if (hit > 0) emit(inside_ ? EventKind::Thinking : EventKind::Content, pending_.substr(0, hit));
        pending_.erase(0, hit + hitLength);
        inside_ = !inside_;
        // A marker is usually followed by blank lines that belong to the formatting, not the text.
        size_t skip = 0;
        while (skip < pending_.size() && pending_[skip] == '\n') skip++;
        pending_.erase(0, skip);
        continue;
      }
      size_t keep = 0;
      if (!final) {
        for (const auto &tag : targets) {
          for (size_t len = std::min(tag.size() - 1, pending_.size()); len > keep; len--) {
            if (pending_.compare(pending_.size() - len, len, tag, 0, len) == 0) {
              keep = len;
              break;
            }
          }
        }
      }
      size_t emitLength = pending_.size() - keep;
      if (!final) emitLength = std::min(emitLength, completeUtf8Length(pending_.substr(0, emitLength)));
      if (emitLength == 0) return;
      emit(inside_ ? EventKind::Thinking : EventKind::Content, pending_.substr(0, emitLength));
      pending_.erase(0, emitLength);
    }
  }

  bool inside_;
  std::string startTag_;
  std::vector<std::string> endTags_;
  std::string pending_;
};

}  // namespace

struct Engine::Templates {
  common_chat_templates_ptr templates;
};

std::unique_ptr<Engine> Engine::load(const std::string &path, const Options &options, std::string &error) {
  static std::atomic<bool> backendReady{false};
  if (!backendReady.exchange(true)) llama_backend_init();

  auto started = Clock::now();
  std::unique_ptr<Engine> engine(new Engine());
  llama_model_params modelParams = llama_model_default_params();
  modelParams.n_gpu_layers = 0;
  modelParams.load_mode = options.useMmap ? LLAMA_LOAD_MODE_MMAP : LLAMA_LOAD_MODE_NONE;
  engine->model_ = llama_model_load_from_file(path.c_str(), modelParams);
  if (!engine->model_) {
    error = "The model file could not be loaded.";
    return nullptr;
  }

  llama_context_params contextParams = llama_context_default_params();
  contextParams.n_ctx = (uint32_t)options.contextTokens;
  contextParams.n_batch = 512;
  contextParams.n_ubatch = 512;
  contextParams.n_threads = options.threads;
  contextParams.n_threads_batch = options.threads;
  contextParams.no_perf = true;
  engine->ctx_ = llama_init_from_model(engine->model_, contextParams);
  if (!engine->ctx_) {
    error = "Not enough memory to run this model.";
    return nullptr;
  }
  engine->batchSize_ = (int)llama_n_batch(engine->ctx_);
  engine->contextTokens_ = (int)llama_n_ctx(engine->ctx_);
  engine->canTrim_ = !llama_model_is_recurrent(engine->model_) && !llama_model_is_hybrid(engine->model_);

  engine->templates_ = std::make_unique<Templates>();
  engine->templates_->templates = common_chat_templates_init(engine->model_, "");
  if (!engine->templates_->templates) {
    error = "The model has no chat template.";
    return nullptr;
  }
  common_chat_templates_inputs probe;
  probe.messages = {message("user", "hi")};
  probe.add_generation_prompt = true;
  engine->supportsThinking_ = common_chat_templates_apply(engine->templates_->templates.get(), probe).supports_thinking;
  engine->loadSeconds_ = secondsSince(started);
  return engine;
}

Engine::~Engine() {
  if (ctx_) llama_free(ctx_);
  if (model_) llama_model_free(model_);
}

uint64_t Engine::modelBytes() const { return model_ ? llama_model_size(model_) : 0; }

bool Engine::decode(const std::vector<int32_t> &tokens, size_t from, size_t to, bool) {
  for (size_t at = from; at < to; at += (size_t)batchSize_) {
    if (cancelled_.load()) return false;
    size_t count = std::min((size_t)batchSize_, to - at);
    llama_batch batch = llama_batch_get_one(const_cast<llama_token *>(tokens.data()) + at, (int32_t)count);
    if (llama_decode(ctx_, batch) != 0) return false;
  }
  return true;
}

void Engine::snapshotPrompt(const std::vector<int32_t> &prefix) {
  size_t size = llama_state_seq_get_size(ctx_, 0);
  snapshot_.state.resize(size);
  size_t written = llama_state_seq_get_data(ctx_, snapshot_.state.data(), size, 0);
  if (written == 0) {
    snapshot_ = Snapshot();
    return;
  }
  snapshot_.state.resize(written);
  snapshot_.tokens = prefix;
}

// Brings the context to the longest reusable state for `prompt` and reports how many tokens it already covers.
void Engine::restoreTo(const std::vector<int32_t> &prompt, int &reused) {
  reused = 0;
  size_t limit = prompt.empty() ? 0 : prompt.size() - 1;  // the last token is always run, to get its logits
  llama_memory_t memory = llama_get_memory(ctx_);
  size_t shared = std::min(commonPrefix(cached_, prompt), limit);
  if (canTrim_ && shared > 0 && llama_memory_seq_rm(memory, 0, (llama_pos)shared, -1)) {
    cached_.resize(shared);
    reused = (int)shared;
    return;
  }
  llama_memory_clear(memory, true);
  cached_.clear();
  if (!snapshot_.tokens.empty() && snapshot_.tokens.size() <= limit &&
      commonPrefix(snapshot_.tokens, prompt) == snapshot_.tokens.size() &&
      llama_state_seq_set_data(ctx_, snapshot_.state.data(), snapshot_.state.size(), 0) > 0) {
    cached_ = snapshot_.tokens;
    reused = (int)cached_.size();
    return;
  }
  llama_memory_clear(memory, true);
}

Stats Engine::generate(const std::vector<Turn> &turns, int think, int maxTokens,
                       const std::function<bool(EventKind, const std::string &)> &onEvent) {
  cancelled_.store(false);
  Stats stats;
  stats.loadSeconds = loadSeconds_;
  auto started = Clock::now();
  const llama_vocab *vocab = llama_model_get_vocab(model_);

  common_chat_templates_inputs inputs;
  for (const auto &turn : turns) inputs.messages.push_back(message(turn.role, turn.content));
  inputs.add_generation_prompt = true;
  inputs.enable_thinking = think < 0 ? true : think > 0;
  auto rendered = common_chat_templates_apply(templates_->templates.get(), inputs);
  std::string text = rendered.prompt.str();
  std::vector<llama_token> prompt = tokenize(vocab, text);
  if (prompt.empty()) {
    stats.stopReason = "contextFull";
    return stats;
  }
  if ((int)prompt.size() + 8 >= contextTokens_) {
    stats.promptTokens = (int)prompt.size();
    stats.stopReason = "contextFull";
    return stats;
  }
  stats.promptTokens = (int)prompt.size();

  // The part of the prompt that the next turn will render identically: everything before this turn's generation prompt.
  size_t boundary = 0;
  if (!canTrim_ && !rendered.generation_prompt.empty() && text.size() > rendered.generation_prompt.size() &&
      text.compare(text.size() - rendered.generation_prompt.size(), std::string::npos, rendered.generation_prompt) == 0) {
    std::string head = text.substr(0, text.size() - rendered.generation_prompt.size());
    std::vector<llama_token> headTokens = tokenize(vocab, head);
    if (!headTokens.empty() && headTokens.size() < prompt.size() &&
        std::equal(headTokens.begin(), headTokens.end(), prompt.begin()))
      boundary = headTokens.size();
  }

  int reused = 0;
  restoreTo(prompt, reused);
  stats.reusedTokens = reused;
  stats.prefilledTokens = (int)prompt.size() - reused;

  size_t at = (size_t)reused;
  if (boundary > at) {
    if (!decode(prompt, at, boundary, false)) {
      cached_.clear();
      llama_memory_clear(llama_get_memory(ctx_), true);
      stats.stopReason = cancelled_.load() ? "cancelled" : "contextFull";
      return stats;
    }
    snapshotPrompt(std::vector<int32_t>(prompt.begin(), prompt.begin() + boundary));
    at = boundary;
  }
  if (!decode(prompt, at, prompt.size(), true)) {
    cached_.clear();
    llama_memory_clear(llama_get_memory(ctx_), true);
    stats.stopReason = cancelled_.load() ? "cancelled" : "contextFull";
    return stats;
  }
  cached_ = std::vector<int32_t>(prompt.begin(), prompt.end());
  stats.promptSeconds = secondsSince(started);

  llama_sampler_chain_params chainParams = llama_sampler_chain_default_params();
  chainParams.no_perf = true;
  llama_sampler *sampler = llama_sampler_chain_init(chainParams);
  bool thinking = inputs.enable_thinking && rendered.supports_thinking;
  llama_sampler_chain_add(sampler, llama_sampler_init_top_k(20));
  llama_sampler_chain_add(sampler, llama_sampler_init_top_p(thinking ? 0.95f : 0.8f, 1));
  llama_sampler_chain_add(sampler, llama_sampler_init_temp(thinking ? 0.6f : 0.7f));
  llama_sampler_chain_add(sampler, llama_sampler_init_dist((uint32_t)std::chrono::duration_cast<std::chrono::nanoseconds>(
                                                              Clock::now().time_since_epoch()).count()));

  // The generation prompt may already have opened the reasoning block; then the stream starts inside it.
  bool startsInside = false;
  if (thinking && !rendered.thinking_start_tag.empty()) {
    std::string tail = rendered.generation_prompt;
    while (!tail.empty() && (tail.back() == '\n' || tail.back() == ' ')) tail.pop_back();
    const std::string &tag = rendered.thinking_start_tag;
    startsInside = tail.size() >= tag.size() && tail.compare(tail.size() - tag.size(), tag.size(), tag) == 0;
  }
  ThinkingSplitter splitter(startsInside, thinking ? rendered.thinking_start_tag : "",
                            thinking ? rendered.thinking_end_tags : std::vector<std::string>{});
  bool wantsMore = true;
  auto emit = [&](EventKind kind, const std::string &piece) {
    if (piece.empty()) return;
    if (stats.firstTokenSeconds == 0) stats.firstTokenSeconds = secondsSince(started);
    if (wantsMore && !onEvent(kind, piece)) wantsMore = false;
  };

  auto generationStart = Clock::now();
  std::string utf8Pending;
  stats.stopReason = "length";
  for (int i = 0; i < maxTokens; i++) {
    if (cancelled_.load() || !wantsMore) {
      stats.stopReason = "cancelled";
      break;
    }
    llama_token token = llama_sampler_sample(sampler, ctx_, -1);
    if (llama_vocab_is_eog(vocab, token)) {
      stats.stopReason = "complete";
      break;
    }
    stats.generatedTokens++;
    utf8Pending += pieceOf(vocab, token);
    size_t ready = completeUtf8Length(utf8Pending);
    if (ready > 0) {
      splitter.feed(utf8Pending.substr(0, ready), emit);
      utf8Pending.erase(0, ready);
    }
    if ((int)cached_.size() + 1 >= contextTokens_) {
      stats.stopReason = "contextFull";
      break;
    }
    llama_batch batch = llama_batch_get_one(&token, 1);
    if (llama_decode(ctx_, batch) != 0) {
      stats.stopReason = "contextFull";
      break;
    }
    cached_.push_back(token);
  }
  splitter.feed(utf8Pending, emit);
  splitter.finish(emit);
  stats.generateSeconds = secondsSince(generationStart);
  llama_sampler_free(sampler);
  if (stats.stopReason == "cancelled") {
    // A cut-off reply leaves a state no later prompt will match; start the next turn clean.
    if (canTrim_) {
      cached_.resize(prompt.size());
    }
  }
  return stats;
}

}  // namespace quock
