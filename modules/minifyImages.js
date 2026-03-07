import fs from 'fs';
import { glob } from 'glob';
import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import path from 'path';
import { logger } from './logger.js';
const fsp = fs.promises;

async function minifyImages(srcDir, distDir) {
	// process only raster images (SVGs are handled separately)
	const imageFiles = await glob(path.join(srcDir, '**/*.{jpg,jpeg,png,gif}'));
	const outputFiles = [];
	let beforeSize = 0;
	let afterSize = 0;
	for (const file of imageFiles) {
		const relativePath = path.relative(srcDir, file);
		const outputPath = path.join(distDir, relativePath);
		await fsp.mkdir(path.dirname(outputPath), { recursive: true });
		const originalSize = fs.statSync(file).size;
		beforeSize += originalSize;

		// optimize in-place by extension
		let writtenOptimized = false;
		const ext = path.extname(file).toLowerCase();
		try {
			const imageminPlugins = [];
			if (ext === '.jpg' || ext === '.jpeg') {
				imageminPlugins.push(imageminMozjpeg({ quality: 75 }));
			} else if (ext === '.png') {
				imageminPlugins.push(imageminPngquant({ quality: [0.6, 0.8] }));
			}
			if (imageminPlugins.length) {
				const [result] = await imagemin([file], {
					plugins: imageminPlugins,
				});
				if (
					result &&
					result.data &&
					result.data.length < originalSize
				) {
					await fsp.writeFile(outputPath, result.data);
					writtenOptimized = true;
					logger.info(`Minified image: ${relativePath}`);
				}
			}
		} catch (e) {
			logger.debug('imagemin error', e);
		}

		if (!writtenOptimized) {
			await fsp.copyFile(file, outputPath);
			logger.info(`Copied original (no savings): ${relativePath}`);
		}

		const inBytes = originalSize;
		const outBytes = fs.statSync(outputPath).size;
		const diffColor = outBytes < inBytes ? 'green' : 'red';
		logger.debug(
			`Image ${relativePath}: ` +
			logger.colorize(`${inBytes}→${outBytes}`, diffColor),
			{ input: file, output: outputPath, inBytes, outBytes },
		);
		afterSize += outBytes;
		outputFiles.push(outputPath);
	}
	return { paths: outputFiles, before: beforeSize, after: afterSize };
}

export { minifyImages };
