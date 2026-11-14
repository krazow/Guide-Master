// The GitHub workflow cannot hang for hours or pile up: CI runs the shared release kit's QA (whose job has a
// 30-minute timeout and runs the build check and these tests), and a newer run on the same branch or pull request
// cancels the older one.
const fs = require('fs'), path = require('path');
const { assert } = require('./helpers');
const YML = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'release.json'), 'utf8'));
module.exports = [
  { name: 'ci: runs the release kit QA with a concurrency group that cancels superseded runs', only: 'index.html', fn: async () => {
    assert.ok(/uses: krazow\/release-kit\/\.github\/workflows\/qa\.yml@v1/.test(YML), 'uses the release kit QA');
    assert.ok(/\nconcurrency:\n  group: .*(github\.ref|pull_request\.number)/.test(YML), 'concurrency group per ref');
    assert.ok(/\n  cancel-in-progress: true/.test(YML), 'cancel-in-progress');
    assert.ok((CFG.prebuild || []).some(c => /build\.py --check/.test(c)), 'the build check runs before the tests');
  } },
];
