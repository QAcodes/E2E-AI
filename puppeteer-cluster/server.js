var mongoDB = {};
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";
const dbName = "mydb";

mongoDB.insertData = async function (tableName, data) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db(dbName);
      var myobj = data;
      dbo.collection(tableName).insertOne(myobj, function (err, res) {
        if (err) throw err;
        console.log("data inserted");
        db.close();
        resolve(res);
      });
    });
  });
}

mongoDB.deleteData = async function (tableName, data) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db(dbName);
      var myquery = { _id: data._id };
      dbo.collection(tableName).deleteOne(myquery, function (err, obj) {
        if (err) throw err;
        console.log("data deleted");
        db.close();
        resolve(obj);
      });
    });
  });
}

mongoDB.patchData = async function (tableName, data) {
  await mongoDB.deleteData(tableName, data);
  await mongoDB.insertData(tableName, data);
}

mongoDB.queryData = function (tableName, data) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db(dbName);
      var query = data;
      dbo.collection(tableName).find(query).toArray(function (err, result) {
        if (err) throw err;
        db.close();
        resolve(result);
      });
    });
  });
}

mongoDB.updateData = function (tableName, data, setData) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url , {useNewUrlParser: true, useUnifiedTopology: true} , function(err, db) {
      if (err) throw err;
      var dbo = db.db(dbName);
      var myquery = data;
      var newvalues = { $set: setData };
      dbo.collection(tableName).updateOne(myquery, newvalues, function(err, res) {
        if (err) throw err;
        console.log("1 document updated");
        db.close();
        resolve(res);
      });
    });
  });
}

// patchData("algoCluster", { _id: 0, state: "inprogress", data: [0, 1, 2, 3, 4, 5] })
// patchData("algoCluster", { _id: 1, state: "hold", data: [0, 1, 2, 3, 4, 5] })
// var checkHold = queryData("algoCluster", {state : "hold"});

// console.log(globalCheck);
// if (checkHold){
//   console.log("haros");
// } else {
//   console.log("no avaialble cluster");
// }

module.exports = mongoDB;