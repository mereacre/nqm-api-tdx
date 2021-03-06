module.exports = (function() {
  "use strict";

  const log = require("debug")("nqm-api-tdx:account");
  const sendRequest = require("./send-request");

  const createEmailAccount = function(emailAddress, verified, approved, cb) {
    log("createEmailAccount");
    const postData = {
      username: emailAddress,
      accountType: "user",    // user-based account (not a share key)
      authService: "local",   // email-based account (not oauth)
      verified: verified,
      approved: approved,
    };
    return this.commandPost.call(this, "account/create", postData, cb);
  };

  function AccountAPI(config) {
    this.commandPost = sendRequest.post(`${config.commandHost}/commandSync`);
    this.createEmailAccount = createEmailAccount;
  }

  return AccountAPI;
}());
