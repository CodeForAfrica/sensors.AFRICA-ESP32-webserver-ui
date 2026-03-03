import fs from 'fs';
import path from 'path';
import { minify as terserMinify } from 'terser';
import { logger } from './logger.js';
const fsp = fs.promises;

async function minifyJs(htmlFiles, distDir, srcDir) {
	const jsFiles = new Set();
	for (const htmlFile of htmlFiles) {
		const content = await fsp.readFile(htmlFile, 'utf-8');
		const regex = /<script\s+src=["']([^"']+)["']\s*><\/script>/g;
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
			logger.debug({
				input: filePath,
				output: 'bundle(scripts.min.js)',
				inBytes: sz,
				outBytes: null,
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
	logger.debug({
		before: beforeSize,
		after: afterSize,
		output: minifiedPath,
	});

	return { paths: [minifiedPath], before: beforeSize, after: afterSize };
}

export { minifyJs };
