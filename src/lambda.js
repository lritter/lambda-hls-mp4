'use strict';

const main = require('./main').main;
const querystring = require('querystring');

exports.handler = (event, context, callback) => {
    const req = event;
    const operation = req.operation || req.queryStringParameters.operation;

    console.log(req)
    if (operation) {
        console.log(`Operation ${operation} 'requested`);
    }

    switch (operation) {
        case 'ping':
            callback(null, 'pong');
            break;
        case 'convert':
            const hlsKey = req.queryStringParameters.input || 's3-p.animoto.com/Stream/wfuFvIlS99sjLoUkQTT2WA/hls.360p15.m3u8';
            const hlsStream = `https://s3.amazonaws.com/${querystring.unescape(hlsKey)}`;
            const renderTitle = req.queryStringParameters.title || 'bobs your uncle';
            let makeResponse = (err, result) => {
                let response = {};

                if(!err) {
                    response.statusCode = 302;
                    response.headers = {
                        "Location" : result.url.Location
                    };
                }
                else {
                    response.statusCode = 500;
                    response.body = JSON.stringify({ error: err });
                }

                console.log("response: " + JSON.stringify(response))
                callback(err, response);
            };
            main(hlsStream, renderTitle, makeResponse);
            break;
        default:
            callback(new Error(`Unrecognized operation "${operation}"`));
    }
};