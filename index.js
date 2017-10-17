var LogService = require("./src/LogService");
var ApiHandler = require("./src/ApiHandler");
var StatsTracker = require("./src/StatsTracker");

LogService.info("index", "Bootstrapping application");
ApiHandler.start();
StatsTracker.start();
LogService.info("index", "Ready to serve requests");
