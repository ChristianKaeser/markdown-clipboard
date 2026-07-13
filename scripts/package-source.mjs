// Produces web-ext-artifacts/source.zip for AMO's source-code submission.
// Because the shipped code is bundled/transpiled by esbuild, AMO reviewers need
// the original source plus the build instructions documented in the README.
// `git archive` gives us exactly the tracked files (node_modules/, dist/, and
// reference/ are all gitignored, so they are excluded automatically).
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';

const outDir = 'web-ext-artifacts';
const outFile = `${outDir}/source.zip`;

mkdirSync(outDir, {recursive: true});
execFileSync('git', ['archive', '--format=zip', '--output', outFile, 'HEAD'], {
	stdio: 'inherit',
});
console.log(`Wrote ${outFile}`);
