module.exports = (function() {
  "use strict";

  const log = require("debug")("nqm-api-tdx:command");
  const sendRequest = require("./send-request");
  const wait = require("./wait-for-resource");
  const waitInfinitely = -1;

  const createDataset = function(postData, waitForResource, cb) {
    const self = this;
    //
    // Param waitForResource is optional => default to true
    if (typeof waitForResource === "function") {
      cb = waitForResource;
      waitForResource = true;
    }
    log("createDataset");
    return this.commandPost.call(this, "resource/create", postData, function(err, resp) {
      if (!err && waitForResource) {
        // eslint-disable-next-line max-len
        const waitForStatus = (!postData.indexStatus || postData.indexStatus === "pending") ? "built" : postData.indexStatus;
        // The wait will be terminated if the index status equals the requested status or "error".
        wait.waitForIndex.call(self, resp.response.id, waitForStatus, waitInfinitely, function(err) {
          cb(err, resp);
        });
      } else {
        cb(err, resp);
      }
    });
  };

  const setDatasetImportFlag = function(datasetId, importing, cb) {
    const self = this;
    log("setDatasetImportFlag");
    return this.commandPost.call(this, "resource/importing", {id: datasetId, importing: importing}, (err, resp) => {
      if (!err) {
        // Wait for the flag.
        wait.waitForImportFlag.call(self, datasetId, importing, function(err) {
          cb(err, resp);
        });
      } else {
        cb(err, resp);
      }
    });
  };

  const rebuildDatasetIndex = function(datasetId, cb) {
    const self = this;
    log("rebuildDatasetIndex");
    return this.commandPost.call(this, "resource/index/rebuild", {id: datasetId}, function(err, resp) {
      if (!err) {
        // Wait for the index status to be pending.
        // The wait will be terminated if the index status becomes "built" or "error".
        wait.waitForIndex.call(self, datasetId, "built", waitInfinitely, function(err) {
          cb(err, resp);
        });
      } else {
        cb(err, resp);
      }
    });
  };

  const suspendDatasetIndex = function(datasetId, cb) {
    const self = this;
    log("suspendDatasetIndex");
    return this.commandPost.call(this, "resource/index/suspend", {id: datasetId}, function(err, resp) {
      if (!err) {
        // Wait for the index status to be suspended.
        // The wait will be terminated if the index status becomes "suspended" or "error".
        wait.waitForIndex.call(self, datasetId, "suspended", waitInfinitely, function(err) {
          cb(err, resp);
        });
      } else {
        cb(err, resp);
      }
    });
  };

  const truncateDataset = function(id, restart, cb) {
    const self = this;

    log("truncateDataset");
    if (typeof restart === "function") {
      cb = restart;
      restart = true;
    }

    return this.getDataset(id, function(err, resp) {
      if (err) {
        return cb(err);
      }

      const dataset = resp;
      log("about to truncate dataset and wait for store to not be %s and index status to be %s",
        dataset.store,
        dataset.indexStatus
      );
      return self.commandPost.call(self, "resource/truncate", {id: id, noRestart: !restart}, function(err, resp) {
        if (!err) {
          // Wait for the store to change.
          wait.waitForTruncate.call(self, id, dataset.store, function(err) {
            if (err) {
              return cb(err);
            }
            // Wait for the index status to be restored to its original value.
            wait.waitForIndex.call(self, id, dataset.indexStatus, waitInfinitely, function(err) {
              cb(err, resp);
            });
          });
        } else {
          cb(err, resp);
        }
      });
    });
  };

  const addDatasetData = function(id, data, cb) {
    log("addDatasetData");
    const postData = {
      datasetId: id,
      payload: [].concat(data),
    };
    return this.commandPost.call(this, "dataset/data/createMany", postData, cb);
  };

  const updateDatasetData = function(id, data, upsert, cb) {
    if (typeof upsert === "function") {
      cb = upsert;
      upsert = false;
    }
    log("updateDatasetData");
    const postData = {
      datasetId: id,
      payload: [].concat(data),
      __upsert: !!upsert,
    };
    return this.commandPost.call(this, "dataset/data/updateMany", postData, cb);
  };

  /*
   * Enables multiple datasets to be updated with a single API call.
   *
   * Expects the 'data' param to be an array of data of the form:
   *
   * {
   *    id: "<dataset id>",
   *    d: { <data document> }
   * }
   *
   * Example:
   *
   * { id: tempSensor1, d: { timestamp: 123, temperature: 12.3 }}
   * { id: tempSensor2, d: { timestamp: 123, temperature: 12.8 }}
   * { id: tempSensor1, d: { timestamp: 123, temperature: 12.3 }}
   * { id: co2Sensor, d: { timestamp: 123, co2: 587.6 }}
   * { id: xyz, d: { id: "foo", address: "nowhere" }}
   *
   * This method will throw an error if any of the operations fail.
   * However, it processes the entire data array irrespective of failures,
   * so a failure does not prevent subsequent updates from happening.
   *
   * In the event of an error, the error object message is a list of
   * error details delimited by the '|' character, e.g.
   *
   * catch(err => {
   *  const errors = err.message.split("|");
   *  console.log(errors); // ["duplicate key: timestamp: 123","dataset not found: xyz"]
   * })
   *
   */
  const addDatasetsData = function(data, cb) {
    log("addDatasetsData");
    const postData = {
      payload: [].concat(data),
    };
    return this.commandPost.call(this, "dataset/data/feed", postData, cb);
  };

  const deleteDataset = function(id, cb) {
    log("deleteDataset");
    return this.commandPost.call(this, "resource/delete", {id: id}, cb);
  };

  const deleteDatasetData = function(id, data, cb) {
    log("deleteDatasetData");
    const postData = {
      datasetId: id,
      payload: [].concat(data),
    };
    return this.commandPost.call(this, "dataset/data/deleteMany", postData, cb);
  };

  const addResourceAccess = function(resourceId, accountId, access, cb) {
    log("addResourceAccess");
    const postData = {
      rid: resourceId,
      aid: accountId,
      acc: access,
      src: resourceId,
    };
    return this.commandPost.call(this, "resourceAccess/add", postData, cb);
  };

  const addResourceReadAccess = function(resourceId, accountId, cb) {
    log("addResourceReadAccess");
    return addResourceAccess(resourceId, accountId, ["r"], cb);
  };

  const addResourceWriteAccess = function(resourceId, accountId, cb) {
    log("addResourceWriteAccess");
    return addResourceAccess(resourceId, accountId, ["w"], cb);
  };

  const removeResourceAccess = function(resourceId, accountId, addedBy, access, cb) {
    log("removeResourceAccess");
    const postData = {
      rid: resourceId,
      aid: accountId,
      acc: access,
      by: addedBy,
    };
    return this.commandPost.call(this, "resourceAccess/delete", postData, cb);
  };

  const removeResourceReadAccess = function(resourceId, accountId, addedBy, cb) {
    log("removeResourceReadAccess");
    return removeResourceAccess(resourceId, accountId, addedBy, ["r"], cb);
  };

  const removeResourceWriteAccess = function(resourceId, accountId, addedBy, cb) {
    log("removeResourceWriteAccess");
    return removeResourceAccess(resourceId, accountId, addedBy, ["w"], cb);
  };

  function CommandAPI(config) {
    this.commandPost = sendRequest.post(`${config.commandHost}/commandSync`);
    this.createDataset = createDataset;
    this.truncateDataset = truncateDataset;
    this.addDatasetData = addDatasetData;
    this.addDatasetsData = addDatasetsData;
    this.updateDatasetData = updateDatasetData;
    this.setDatasetImportFlag = setDatasetImportFlag;
    this.suspendDatasetIndex = suspendDatasetIndex;
    this.rebuildDatasetIndex = rebuildDatasetIndex;
    this.deleteDataset = deleteDataset;
    this.deleteDatasetData = deleteDatasetData;
    this.addResourceReadAccess = addResourceReadAccess;
    this.addResourceWriteAccess = addResourceWriteAccess;
    this.removeResourceReadAccess = removeResourceReadAccess;
    this.removeResourceWriteAccess = removeResourceWriteAccess;
  }

  return CommandAPI;
}());
