const LogService = require("./LogService");
const config = require("config");
const PGClient = require("pg").Client;

class StatsTracker {

    constructor() {
        this.usersInfo = {
            labels: [],
            data: {}
        };
    }

    async start() {
        this._db = new PGClient({
            user: config.get("homeserver.db.username"),
            host: config.get("homeserver.db.hostname"),
            database: config.get("homeserver.db.database"),
            password: config.get("homeserver.db.password"),
        });
        LogService.verbose("StatsTracker", "Connecting to database...");
        await this._db.connect();
        LogService.verbose("StatsTracker", "Getting user stats");
        await this._getUserStats();
    }

    async _getUserStats() {
        var userInfo = {
            labels: [],
            data: {},
        };
        var knownMasks = [];
        var minDate = null;
        var maxDate = null;

        // Get labeled users
        let query = "SELECT count(*) as num, floor(creation_ts/86400.0) as creation_days from users where name like $1 group by creation_days";
        for (var dataset of config.get("userTypes")) {
            userInfo.labels.push(dataset.label);
            knownMasks.push(dataset.query);
            LogService.verbose("StatsTracker", "Running query: [" + dataset.query + "] " + query);
            const result = await this._db.query(query, [dataset.query]);
            LogService.verbose("StatsTracker", result.rows);

            userInfo.data[dataset.label] = {};
            for (var row of result.rows) {
                row.creation_days = Number(row.creation_days);
                row.num = Number(row.num);

                userInfo.data[dataset.label][row.creation_days] = row.num;
                if (minDate === null || row.creation_days < minDate) minDate = row.creation_days;
                if (maxDate === null || row.creation_days > maxDate) maxDate = row.creation_days;
            }
        }

        // Get everyone else
        query = "SELECT count(*) as num, floor(creation_ts/86400.0) as creation_days from users where name ";
        for (var i = 0; i < knownMasks.length; i++) query += "not like $" + (i + 1) + " and name ";
        query = query.substring(0, query.length - "and name ".length);
        query += "group by creation_days";
        LogService.verbose("StatsTracker", "Running query: [" + knownMasks + "] " + query);
        const result = await this._db.query(query, knownMasks);
        LogService.verbose("StatsTracker", result.rows);
        userInfo.labels.push("Other");
        userInfo.data["Other"] = {};
        for (var row of result.rows) {
            row.creation_days = Number(row.creation_days);
            row.num = Number(row.num);

            userInfo.data["Other"][row.creation_days] = row.num;
            if (minDate === null || row.creation_days < minDate) minDate = row.creation_days;
            if (maxDate === null || row.creation_days > maxDate) maxDate = row.creation_days;
        }

        // Populate missing data
        LogService.verbose("StatsTracker", "Populating users for missing days");
        for (var label of userInfo.labels) {
            for (var i = minDate; i <= maxDate; i++) {
                if (!userInfo.data[label][i]) {
                    userInfo.data[label][i] = 0;
                }
            }
        }

        LogService.info("StatsTracker", "Publishing new user stats");
        userInfo.startDay = minDate;
        userInfo.endDay = maxDate;
        this.usersInfo = userInfo;
    }
}

module.exports = new StatsTracker();