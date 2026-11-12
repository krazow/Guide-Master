// The GitHub workflow cannot hang for hours or pile up: the job has a timeout, and a newer run on the same branch or pull request cancels the older one.
const fs = require('fs'), path = require('path');
const { assert } = require('./helpers');
const YML = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test.yml'), 'utf8');
module.exports = [
  { name: 'ci: the test job has a timeout and a concurrency group that cancels superseded runs', only: 'index.html', fn: async () => {
    const t = YML.match(/\n    timeout-minutes: (\d+)/); assert.ok(t && +t[1] >= 10 && +t[1] <= 60, 'job timeout-minutes');
    assert.ok(/\nconcurrency:\n  group: .*(github\.ref|pull_request\.number)/.test(YML), 'concurrency group per ref');
    assert.ok(/\n  cancel-in-progress: true/.test(YML), 'cancel-in-progress');
    assert.ok(/run: npm test/.test(YML) && /build\.py --check/.test(YML), 'what the tests run is unchanged');
  } },
];
