import { minify } from 'csso';
import fs from 'fs';
import path from 'path';
import { PurgeCSS } from 'purgecss';
import { logger } from './logger.js';

const fsp = fs.promises;

// distDir: output folder, srcDir: root of source files
// htmlFiles: array of html/js paths used for PurgeCSS content scanning
async function minifyCss(distDir, srcDir, htmlFiles = []) {
	// locate source stylesheet
	const cssEntryPath = path.resolve(srcDir, 'css', 'style.css');

	logger.debug(`Checking path: ${cssEntryPath}`);

	if (!fs.existsSync(cssEntryPath)) {
		logger.error(`Entry CSS not found at ${cssEntryPath}`);
		return { paths: [], before: 0, after: 0 };
	}

	const rawCss = await fsp.readFile(cssEntryPath, 'utf-8');
	const beforeSize = Buffer.byteLength(rawCss);

	logger.info(`Purging unused styles from ${path.basename(cssEntryPath)}`);
	const purgeResult = await new PurgeCSS().purge({
		content: htmlFiles,
		css: [{ raw: rawCss }],
	});
	// if purge returned nothing, log a warning and fall back to original
	if (!purgeResult || purgeResult.length === 0) {
		logger.warn('PurgeCSS did not return any results; using original CSS.');
	}
	const purgedCss = purgeResult[0]?.css ?? rawCss;

	const purgedSize = Buffer.byteLength(purgedCss);
	logger.info(`Purged size: ${purgedSize} bytes`);

	logger.info(`Minifying CSS: ${path.basename(cssEntryPath)}`);
	const minified = minify(purgedCss).css;

	const minifiedPath = path.join(distDir, 'style.min.css');
	await fsp.mkdir(distDir, { recursive: true });
	await fsp.writeFile(minifiedPath, minified, 'utf-8');

	const afterSize = Buffer.byteLength(minified);
	const diffColor = afterSize < beforeSize ? 'green' : 'red';
	logger.info(
		`Created bundle: style.min.css (` +
		logger.colorize(`${beforeSize}→${afterSize}`, diffColor) +
		` bytes)`,
	);

	// debug output for deeper inspection
	logger.debug({
		input: cssEntryPath,
		output: minifiedPath,
		before: beforeSize,
		after: afterSize,
	});

	return { paths: [minifiedPath], before: beforeSize, after: afterSize };
}

export { minifyCss };
