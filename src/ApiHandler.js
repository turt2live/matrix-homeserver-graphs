var express = require("express");
var LogService = require("./LogService");
var config = require("config");
var bodyParser = require('body-parser');

/**
 * Processes and controls API requests
 */
class ApiHandler {

    /**
     * Creates a new API handler
     */
    constructor() {
        this._app = express();
        this._app.use(express.static('web-dist'));
        this._app.use(bodyParser.json());

        // Logging incoming requests
        this._app.use((req, res, next) => {
            LogService.verbose("ApiHandler", "Incoming request: " + req.method + " " + req.url);
            next();
        });

        this._app.get('/api/v1/stats/users', this._getUserStats.bind(this));
    }

    /**
     * Starts the API handler
     */
    start() {
        this._app.listen(config.get('web.port'), config.get('web.address'));
        LogService.info("ApiHandler", "API Listening on " + config.get("web.address") + ":" + config.get("web.port"));
    }

    _getUserStats(req, res) {
        res.status(200).send({error: false, data:[{test:1}]});
    }
}

module.exports = new ApiHandler();