// Host test harness: loads a GGUF, runs a short multi-turn chat and prints reuse stats. Not part of the app build.
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <string>

#include "engine.h"

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: engine_cli model.gguf [think 0|1] [threads]\n");
    return 2;
  }
  int think = argc > 2 ? atoi(argv[2]) : -1;
  quock::Engine::Options options;
  if (argc > 3) options.threads = atoi(argv[3]);
  std::string error;
  auto engine = quock::Engine::load(argv[1], options, error);
  if (!engine) {
    fprintf(stderr, "load failed: %s\n", error.c_str());
    return 1;
  }
  printf("loaded %.1f MB in %.2fs, thinking=%d\n", engine->modelBytes() / 1048576.0, 0.0, engine->supportsThinking());
  std::vector<quock::Turn> history;
  const char *questions[] = {"Mi consigli un libro di fantascienza?", "Perché proprio quello?", "Riassumi in una frase."};
  for (const char *question : questions) {
    history.push_back({"user", question});
    std::string answer, reasoning;
    auto stats = engine->generate(history, think, 160, [&](quock::EventKind kind, const std::string &text) {
      (kind == quock::EventKind::Content ? answer : reasoning) += text;
      return true;
    });
    history.push_back({"assistant", answer});
    printf("--- Q: %s\n[thinking %zu chars] %s\nprompt=%d prefilled=%d reused=%d gen=%d ttft=%.2fs tok/s=%.1f stop=%s\n",
           question, reasoning.size(), answer.c_str(), stats.promptTokens, stats.prefilledTokens, stats.reusedTokens,
           stats.generatedTokens, stats.firstTokenSeconds,
           stats.generateSeconds > 0 ? stats.generatedTokens / stats.generateSeconds : 0.0, stats.stopReason.c_str());
  }
  return 0;
}
