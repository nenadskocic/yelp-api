const Logger = require("./lib/logger.js");
const SlackBot = require("./lib/slack_bot.js");

let logger = new Logger();
logger.log("Hey");

let slack_bot = new SlackBot("yelphelp");
