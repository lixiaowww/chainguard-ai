const authentication = require('./authentication');
const runCargoAudit = require('./creates/run_cargo_audit');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication,
  creates: {
    [runCargoAudit.key]: runCargoAudit,
  },
};
