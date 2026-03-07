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
	const purgedCss = purgeResult[0]?.css ?? rawCss;

	logger.info(`Purged size: ${Buffer.byteLength(purgedCss)} bytes`);
	logger.info(`Minifying CSS: ${path.basename(cssEntryPath)}`);
	const minified = minify(purgedCss).css;

	const minifiedPath = path.join(distDir, 'styles.min.css');
	await fsp.mkdir(distDir, { recursive: true });
	await fsp.writeFile(minifiedPath, minified, 'utf-8');

	const afterSize = Buffer.byteLength(minified);

	logger.info(
		`Created bundle: styles.min.css (${beforeSize} → ${afterSize} bytes)`,
	);

	return { paths: [minifiedPath], before: beforeSize, after: afterSize };
}

export { minifyCss };
