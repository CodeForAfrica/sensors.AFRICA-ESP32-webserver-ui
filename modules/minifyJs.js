import fs from 'fs';
import path from 'path';
import { minify as terserMinify } from 'terser';
import { logger } from './logger.js';
const fsp = fs.promises;

async function minifyJs(htmlFiles, distDir, srcDir) {
	const jsFiles = new Set();
	const jsFilesDebug = [];
	for (const htmlFile of htmlFiles) {
		const content = await fsp.readFile(htmlFile, 'utf-8');
		// match any <script> tag that has a src attribute, regardless of attribute order or other attributes
		const regex =
			/<script\b[^>]*\bsrc=["']([^"'>\s]+)["'][^>]*><\/script>/gi;
		let match;
		while ((match = regex.exec(content)) !== null) {
			jsFiles.add(match[1]);
		}
	}

	let beforeSize = 0;
	const combinedJs = [];
	for (const file of jsFiles) {
		const filePath = path.join(srcDir, file);
		if (fs.existsSync(filePath)) {
			const content = await fsp.readFile(filePath, 'utf-8');
			combinedJs.push(content);
			const sz = fs.statSync(filePath).size;
			beforeSize += sz;
			logger.info(`Minifying JS file: ${file}`);
			// store debug details for later when we know the output size
			jsFilesDebug.push({
				input: filePath,
				output: 'bundle(scripts.min.js)',
				inBytes: sz,
			});
		} else {
			logger.warn(`JS file not found: ${filePath}`);
		}
	}

	const combinedContent = combinedJs.join('\n');
	const minified = await terserMinify(combinedContent, {
		compress: true,
		mangle: true,
	});

	const minifiedPath = path.join(distDir, 'scripts.min.js');
	await fsp.writeFile(minifiedPath, minified.code, 'utf-8');

	const afterSize = minified.code.length;
	const diffColor = afterSize < beforeSize ? 'green' : 'red';
	logger.info(
		`Created bundle: scripts.min.js (` +
		logger.colorize(`${beforeSize}→${afterSize} bytes`, diffColor) +
			`)
	`,
	);
	// update debug entries with actual output size
	jsFilesDebug.forEach((d) => {
		d.outBytes = afterSize; // whole bundle size since files were combined
		logger.debug(d);
	});
	logger.debug({
		before: beforeSize,
		after: afterSize,
		output: minifiedPath,
	});

	return { paths: [minifiedPath], before: beforeSize, after: afterSize };
}

export { minifyJs };
