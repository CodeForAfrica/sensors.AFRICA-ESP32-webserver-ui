import fs from 'fs';
import { glob } from 'glob';
import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
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

		// attempt imagemin optimization first (lossless/lossy depending on type)
		let sourceFile = file;
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
					result.data.length < fs.statSync(file).size
				) {
					// use optimized buffer
					sourceFile = path.join(os.tmpdir(), path.basename(file));
					await fsp.writeFile(sourceFile, result.data);
				}
			}
		} catch (e) {
			logger.debug('imagemin error', e);
		}

		const converted = outputPath.replace(/\.(jpg|jpeg|png|gif)$/, '.webp');
		beforeSize += fs.statSync(sourceFile).size;
		await sharp(sourceFile)
			.resize({ width: 800, withoutEnlargement: true })
			.toFormat('webp', { quality: 75 })
			.toFile(converted);
		const outStat = fs.statSync(converted);
		let finalPath = converted;
		if (outStat.size >= fs.statSync(sourceFile).size) {
			// conversion not beneficial: copy original instead
			await fsp.copyFile(sourceFile, outputPath);
			finalPath = outputPath;
			logger.info(`Copied original (no savings): ${relativePath}`);
		} else {
			logger.info(
				`Minified: ${relativePath} → ${path.basename(converted)}`,
			);
		}
		const inBytes = fs.statSync(sourceFile).size;
		const outBytes = fs.statSync(finalPath).size;
		const diffColor = outBytes < inBytes ? 'green' : 'red';
		logger.debug(
			`Image ${relativePath}: ` +
			logger.colorize(`${inBytes}→${outBytes}`, diffColor),
			{ input: sourceFile, output: finalPath, inBytes, outBytes },
		);
		// tally final size rather than preliminary one
		afterSize += fs.statSync(finalPath).size;
		outputFiles.push(finalPath);
	}
	return { paths: outputFiles, before: beforeSize, after: afterSize };
}

export { minifyImages };
