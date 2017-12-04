'use strict';

const main = require('./main').main;

exports.handler = (event, context, callback) => {
    const req = event;
    const operation = req.operation;
    delete req.operation;
    console.log(req)
    if (operation) {
        console.log(`Operation ${operation} 'requested`);
    }

    switch (operation) {
        case 'ping':
            callback(null, 'pong');
            break;
        case 'convert':
            const hlsStream = 'https://s3.amazonaws.com/s3-p.animoto.com/Stream/wfuFvIlS99sjLoUkQTT2WA/hls.360p15.m3u8';
            const renderTitle = 'bobs your uncle';
            main(hlsStream, renderTitle, callback);
            break;
        default:
            callback(new Error(`Unrecognized operation "${operation}"`));
    }
};