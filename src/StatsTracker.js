const LogService = require("./LogService");
const config = require("config");
const PGClient = require("pg").Client;

class StatsTracker {

    constructor() {
        this._users = {
            labels: {},
            data: {}
        };
    }

    get userData() {
        return this._users;
    }

    async start() {
        setInterval(this._update.bind(this), 60 * 60 * 1000); // once an hour, update
        await this._update();
    }

    async _update() {
        var db = new PGClient({
            user: config.get("homeserver.db.username"),
            host: config.get("homeserver.db.hostname"),
            database: config.get("homeserver.db.database"),
            password: config.get("homeserver.db.password"),
        });

        LogService.info("StatsTracker", "Updating statistics information for all series (connecting to DB)");
        await db.connect();

        LogService.info("StatsTracker", "Updating user statistics");
        this._users = await this._getUserStats(db);

        LogService.info("StatsTracker", "Disconnecting from database");
        await db.end();

        LogService.info("StatsTracker", "Statistics updated");
    }

    async _getUserStats(db) {
        var userData = {
            labels: [],
            data: {},
        };
        var knownMasks = [];
        var minDate = null;
        var maxDate = null;
        var noPatternSeries = [];

        // Get labeled users
        let query = "SELECT count(*) as num, floor(creation_ts/86400.0) as creation_days from users where name like $1 group by creation_days";
        for (var seriesInfo of config.get("series.users")) {
            userData.labels[seriesInfo.label] = seriesInfo.color;
            if (!seriesInfo.pattern) {
                noPatternSeries.push(seriesInfo.label);
                continue;
            }
            knownMasks.push(seriesInfo.pattern);
            LogService.verbose("StatsTracker", "Running query: [" + seriesInfo.pattern + "] " + query);
            const result = await db.query(query, [seriesInfo.pattern]);
            LogService.verbose("StatsTracker", result.rows);

            userData.data[seriesInfo.label] = {};
            for (var row of result.rows) {
                row.creation_days = Number(row.creation_days);
                row.num = Number(row.num);

                userData.data[seriesInfo.label][row.creation_days] = row.num;
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
        const result = await db.query(query, knownMasks);
        LogService.verbose("StatsTracker", result.rows);
        for (var row of result.rows) {
            row.creation_days = Number(row.creation_days);
            row.num = Number(row.num);

            for (var seriesLabel of noPatternSeries) {
                if (!userData.data[seriesLabel]) userData.data[seriesLabel] = {};
                userData.data[seriesLabel][row.creation_days] = row.num;
            }

            if (minDate === null || row.creation_days < minDate) minDate = row.creation_days;
            if (maxDate === null || row.creation_days > maxDate) maxDate = row.creation_days;
        }

        // Populate missing data
        LogService.verbose("StatsTracker", "Populating users for missing days");
        for (var label in userData.labels) {
            for (var i = minDate; i <= maxDate; i++) {
                if (!userData.data[label][i]) {
                    userData.data[label][i] = 0;
                }
            }
        }

        userData.startDay = minDate;
        userData.endDay = maxDate;
        return userData;
    }
}

module.exports = new StatsTracker();