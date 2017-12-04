'use strict';

const tmpdir = require('os').tmpdir;
const join = require('path').join;
const createHash = require('crypto').createHash;
const spawn = require('child_process').spawn;
const execFile = require('child_process').execFile;
const existsSync = require('fs').existsSync;
const mkdirp = require('mkdirp');
const fs = require('fs');
const AWS = require('aws-sdk');

let log = console.log;

const ffmpegPath = process.env['LAMBDA_TASK_ROOT'] ? './ffmpeg-engine' : 'ffmpeg';
const rootPath = process.env['LAMBDA_TASK_ROOT'] ? process.env['LAMBDA_TASK_ROOT'] : ''
const ffmpegEnvLambda = {
  "LD_PRELOAD":`${rootPath}/libX11.so.6:${rootPath}/libXau.so.6:${rootPath}/libXdmcp.so.6:${rootPath}/libXext.so.6:${rootPath}/libXv.so.1:${rootPath}/libbz2.so.1.0`
};
const ffmpegEnv = process.env['LAMBDA_TASK_ROOT'] ? ffmpegEnvLambda : {};
const tmpRoot = process.env['TEMP'] || tmpdir();
// /** @type string **/
// const tempDir = process.env['TEMP'] || tmpdir();
// const outputDir = join(tempDir, 'outputs');


function setupWorkspaceSync(tmp, baggage = {}) {
  return new Promise((resolve, reject) => {
    var tmpDir = tmp || tmpdir();
    var out = join(tmpDir, 'outputs');
    if (!existsSync(out)) {
      	if(!mkdirp.sync(out)) {
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
  log('env:');
  log(process.env);

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

		const opts = {
      env: ffmpegEnv
			// cwd: baggage.tmp.tmpDir
		};

    console.log(opts);

    console.log(fs.readdirSync('.'));

		var ff = spawn(ffmpegPath, args, opts);
    // var ff = spawn('ldd', [ffmpegPath], opts);
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
    const s3 = new AWS.S3();
    const params = { 
      Bucket : 'hls-stitcher', 
      Key    : baggage.output.filename, 
      Body   : fs.createReadStream(file) };
    s3.upload(params, function (err, data) {
      if (err) {
        reject(err);
      }
      else {
        baggage.url = data;
        resolve(baggage);
      }
    });
  });
}

function main(hlsStream, title, cb) {
  var baggage = {};

  checkInput(hlsStream, baggage)
  .then(result => {
    return setupWorkspaceSync(tmpRoot, result);
  })
  .then(result => {
    return computeOutputFileName(result.input, result);
  })
  .then(result => {
    return ffmpeg(result.input, result.output.fullPath, result);
  })
  .then(result => {
    console.log(result);
    return storeFile(result.transcodeResults.outputFile, title, result);
  })
  .then(result => {
    log(result);
    cb(null, result);
  }).catch(reason => {
    cb(reason, null);
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

exports.main = main;
