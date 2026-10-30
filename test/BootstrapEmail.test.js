const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const BootstrapEmail = require('../src/BootstrapEmail');

const LOG_LEVEL = BootstrapEmail.LOG_LEVEL.FATAL;

function createTempDir(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-email-'));
	t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
	return dir;
}

test('compiles all bundled examples', () => {
	const inputDir = path.join(__dirname, '..', 'examples', 'input');
	const files = fs.readdirSync(inputDir).map(name => path.join(inputDir, name));
	const outputs = new BootstrapEmail(files, {logLevel: LOG_LEVEL}).compile();

	assert.equal(outputs.length, files.length);
	outputs.forEach(output => {
		assert.ok(output.document.startsWith(BootstrapEmail.DOCTYPE));
		assert.ok(!output.document.includes('bootstrap-email-sass-variables'));
	});
});

test('compiles scss and extracts its variables', (t) => {
	const dir = createTempDir(t);
	const style = path.join(dir, 'style.scss');
	fs.writeFileSync(style, [
		'$grid-columns: 16;',
		'$container-max-width: 480px;'
	].join('\n'));

	const email = new BootstrapEmail(
		'<div class="container"><div class="row"><div class="col-9">Hello</div></div></div>',
		{
			style,
			variables: {'$container-max-width': 500},
			logLevel: LOG_LEVEL
		}
	);

	assert.equal(email._vars['$grid-columns'], 16);
	assert.equal(email._vars['$container-max-width'], 480);

	const html = email.compile();
	assert.match(html, /max-width:\s*480px/);
	assert.match(html, /bte-col-9/);
	assert.match(html, /class="col-7"/);
});

test('compiles indented sass and extracts its variables', (t) => {
	const dir = createTempDir(t);
	const style = path.join(dir, 'style.sass');
	fs.writeFileSync(style, [
		'$grid-columns: 8',
		'$container-max-width: 420px'
	].join('\n'));

	const email = new BootstrapEmail('<div class="container"></div>', {
		style,
		variables: {'$container-max-width': 500},
		logLevel: LOG_LEVEL
	});

	assert.equal(email._vars['$grid-columns'], 8);
	assert.equal(email._vars['$container-max-width'], 420);
	assert.match(email.compile(), /max-width:\s*420px/);
});

test('ignores configured variables missing from the stylesheet', (t) => {
	const dir = createTempDir(t);
	const style = path.join(dir, 'style.scss');
	fs.writeFileSync(style, '$grid-columns: 12;');

	const email = new BootstrapEmail('<p>Hello</p>', {
		style,
		variables: {'$missing-variable': 1},
		logLevel: LOG_LEVEL
	});

	assert.equal(email._vars['$missing-variable'], 1);
	assert.doesNotThrow(() => email.compile());
});

test('keeps css style files working', (t) => {
	const dir = createTempDir(t);
	const style = path.join(dir, 'style.css');
	fs.writeFileSync(style, '.custom { color: red; }');

	const email = new BootstrapEmail('<p class="custom">Hello</p>', {
		style,
		logLevel: LOG_LEVEL
	});

	assert.match(email.compile(), /color:\s*red/);
});
