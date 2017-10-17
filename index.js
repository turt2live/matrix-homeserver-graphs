var LogService = require("./src/LogService");
var ApiHandler = require("./src/ApiHandler");
var StatsTracker = require("./src/StatsTracker");

LogService.info("index", "Bootstrapping application");
StatsTracker.start();
ApiHandler.start();
LogService.info("index", "Ready to serve requests");
