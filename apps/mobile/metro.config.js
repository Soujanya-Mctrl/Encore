const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro') // make sure this import exists
const path = require('path')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)
const existingBlockList = config.resolver.blockList
config.resolver.blockList = [
  ...[existingBlockList].flat().filter(Boolean),
  /[/\\]\._[^/\\]+$/,
]
const contractsSource = path.resolve(__dirname, '../../packages/contracts/src') + path.sep
const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromContracts = context.originModulePath.startsWith(contractsSource)
  const sourceName = fromContracts && moduleName.startsWith('.') && moduleName.endsWith('.js')
    ? moduleName.slice(0, -3)
    : moduleName
  return (resolveRequest ?? context.resolveRequest)(context, sourceName, platform)
}

// Apply uniwind modifications before exporting
const uniwindConfig = withUniwindConfig(config, {
  // relative path to your global.css file
  cssEntryFile: './src/global.css',
  // optional: path to typings
  dtsFile: './src/uniwind-types.d.ts',
})

// Cache transforms per project; the machine-wide Metro cache can serve stale transforms from other projects.
uniwindConfig.cacheStores = ({ FileStore }) => [
  new FileStore({ root: path.join(__dirname, 'node_modules', '.cache', 'metro') }),
]

module.exports = uniwindConfig
