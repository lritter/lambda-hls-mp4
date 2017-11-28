'use strict';

import {tmpdir} from 'os';
import {join} from 'path';
import {createHash} from 'crypto';
import {spawn, execFile} from 'child_process';
import {existsSync} from 'fs';
import {mkdirP} from 'mkdirp'

let log = console.log;

// /** @type string **/
// const tempDir = process.env['TEMP'] || tmpdir();
// const outputDir = join(tempDir, 'outputs');

function setupWorkspaceSync(tmp, baggage = {}) {
  return new Promise((resolve, reject) => {
    var tmpDir = tmp || tmpdir();
    var out = join(tmpDir, 'outputs');
    if (!existsSync(out)) {
      	if(!mkdirP.sync(out)) {
          reject(`couldn't make ${out}`);
        }
    }
    baggage.tmp = { tempDir: tmpDir, outputsDir: out }
    resolve(baggage);
  });
}

function checkInput(input, baggage = {}) {
  return new Promise((resolve, reject) => {
    baggage.input = input;
    resolve(baggage);
  });
}

function computeOutputFileName(input, baggage = {}) {
  return new Promise((resolve, reject) => {
    var hash = createHash('sha256');
    hash.update(input);

    baggage.output = { filename: hash.digest('hex')+".mp4" };
    baggage.output.fullPath = join(baggage.tmp.outputsDir, baggage.output.filename);
    resolve(baggage);
  });
}

function ffmpeg(input, output, baggage = {}) {
	log('Starting FFmpeg');

	return new Promise((resolve, reject) => {

		const args = [
      '-y',
      '-loglevel', 'warning',
			'-i', input,
      '-c:a', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-c:v', 'copy',
      output
		];
    log(args);
		const opts = {
			// cwd: baggage.tmp.tmpDir
		};

		var ff = spawn('ffmpeg', args, opts);
		ff.on('message', msg => log(msg))
		  .on('error', reject)
			.on('close', status => {

        var stats = existsSync(output);
        log(stats);

        baggage.transcodeResults = {
          outputFile: output
        };
        resolve(baggage);
      });
    ff.stderr.on('data', buffer => log(buffer.toString('utf8')));
    ff.stdout.on('data', buffer => log(buffer.toString('utf8')));
	});
}

function storeFile(file, target, baggage = {}) {
  return new Promise((resolve, reject) => {
    execFile('cp', [file, target], (err) => {

      if(err) {
        reject(err);
      }
      else {
        baggage.coppied = target;
        resolve(baggage);
      }
    }).on('error', err => reject(err));
  });
}

export function main() {
  var baggage = {};
  var input = "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8";

  checkInput(input, baggage)
  .then(result => {
    return setupWorkspaceSync(process.env['TEMP'], result);
  })
  .then(result => {
    return computeOutputFileName(result.input, result);
  })
  .then(result => {
    return ffmpeg(result.input, result.output.fullPath, result);
  })
  .then(result => {
    return storeFile(result.transcodeResults.outputFile, join('.', 'result.mp4'), result);
  })
  .then(result => {
    log(result);
  });

  /*
    - Check input
      - looks like valid HLS, properly signed, etc?
    - Compute output physical file name
    - Try and determine content-disposition file name
    - Check for existing file in S3 CACHE LOCATION
      - if exists, redirect to file via signed cloudfront link
    - Invoke ffmpeg with HLS localtion as input
      (`ffmpeg -i 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8' -c:a copy -bsf:a aac_adtstoasc -c:v copy`)
    - Put the file at the S3 CACHE LOCATION
    - redirect to file via signed cloudfront link
    - Cleanup as needed.

    See: http://blog.ryangreen.ca/2016/01/04/how-to-http-redirects-with-api-gateway-and-lambda/
  */

}
