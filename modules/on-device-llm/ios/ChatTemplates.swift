import Foundation

// Some Ollama MLX builds ship no chat template (Ollama renders prompts in Go, per its `renderer`), and without one the
// tokenizer falls back to plain text and the model answers nothing. These Jinja templates follow each family's own
// format and are written into tokenizer_config.json at install.
enum ChatTemplates {
  // Gemma 4: turns are `<|turn>role … <turn|>`, the assistant role is `model`, and `<|think|>` in the system turn
  // turns reasoning on (it then arrives in a `<|channel>thought … <channel|>` block).
  static let gemma4 = """
    {{ bos_token }}{%- set has_system = messages and messages[0]['role'] == 'system' -%}
    {%- if has_system or enable_thinking -%}<|turn>system
    {% if enable_thinking %}<|think|>{% endif %}{% if has_system %}{{ messages[0]['content'] }}{% endif %}<turn|>
    {% endif -%}
    {%- for message in messages -%}{%- if message['role'] != 'system' -%}<|turn>{{ 'model' if message['role'] == 'assistant' else message['role'] }}
    {{ message['content'] }}<turn|>
    {% endif -%}{%- endfor -%}
    {%- if add_generation_prompt -%}<|turn>model
    {% endif -%}
    """

  static func template(forModelType modelType: String?) -> String? {
    switch modelType {
    case "gemma4", "gemma4_text", "gemma4_unified": gemma4
    default: nil
    }
  }

  // Adds the family's template when the build has none; a template the build ships always wins.
  static func installIfMissing(in directory: URL) throws {
    let tokenizerConfigURL = directory.appending(path: "tokenizer_config.json")
    guard
      var tokenizerConfig = try JSONSerialization.jsonObject(with: Data(contentsOf: tokenizerConfigURL)) as? [String: Any],
      tokenizerConfig["chat_template"] == nil,
      let config = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appending(path: "config.json")))
        as? [String: Any],
      let template = template(forModelType: config["model_type"] as? String)
    else { return }
    tokenizerConfig["chat_template"] = template
    try JSONSerialization.data(withJSONObject: tokenizerConfig, options: [.prettyPrinted, .sortedKeys])
      .write(to: tokenizerConfigURL, options: .atomic)
  }
}
