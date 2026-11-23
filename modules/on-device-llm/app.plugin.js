// Makes the MLX build survive `expo prebuild --clean` and EAS: both regenerate ios/, which is where the two fixes
// below would otherwise live and die.
const { withPodfile } = require("expo/config-plugins");

const MARKER = "# @quock/on-device-llm";
// The packages need iOS 17; every pod below it is lifted, since SDK 27 rejects pods targeting older releases.
const POD_DEPLOYMENT_FLOOR = "17.0";

// React Native's spm_dependency creates package objects inside post_install, and CocoaPods' counter-based UUIDs can
// hand them an id the project already uses (the root object included); Xcode then reports a damaged project.
const POST_INSTALL_BLOCK = `    ${MARKER} begin
    pods_project = installer.pods_project
    taken = pods_project.objects_by_uuid.keys.to_set << pods_project.root_object.uuid
    original_generate_uuid = pods_project.method(:generate_uuid)
    pods_project.define_singleton_method(:generate_uuid) do
      loop do
        uuid = original_generate_uuid.call
        next if taken.include?(uuid)
        taken << uuid
        break uuid
      end
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${POD_DEPLOYMENT_FLOOR}')
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${POD_DEPLOYMENT_FLOOR}'
        end
      end
    end
    ${MARKER} end
`;

function addPostInstallBlock(contents) {
  if (contents.includes(`${MARKER} begin`)) return contents;
  const anchor = /^(\s*)post_install do \|installer\|\n/m;
  if (!anchor.test(contents)) {
    throw new Error(
      "on-device-llm: the Podfile has no post_install block to extend",
    );
  }
  return contents.replace(anchor, (match) => `${match}${POST_INSTALL_BLOCK}`);
}

module.exports = function withOnDeviceLLM(config) {
  return withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = addPostInstallBlock(
      podfileConfig.modResults.contents,
    );
    return podfileConfig;
  });
};
