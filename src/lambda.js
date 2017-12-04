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
            main(callback);
            break;
        default:
            callback(new Error(`Unrecognized operation "${operation}"`));
    }
};