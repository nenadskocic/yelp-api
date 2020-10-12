const fs = require("fs");

class Logger {
  constructor(file = "./testlog.txt") {
    this.file = file;
  }

  log(line) {
    fs.appendFile(this.file, `${line}\n`, function (err) {
      if (err) throw err;
    });
  }
}

module.exports = Logger;
