const ADODB = require("node-adodb");

const connection = ADODB.open(
  `Provider=Microsoft.JET.OLEDB.4.0;
      Data Source=C:/sayram/sayram.mdb;
      Jet OLEDB:System Database=C:/sayram/sayram.mdw;
      User ID=карасай;
      Password=нтеньфл77;`
);

function checkConnection() {
  return new Promise((resolve, reject) => {
    connection
      .execute("SELECT 1")
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

const userState = {};

module.exports = {
  connection,
  checkConnection,
  userState,
};
