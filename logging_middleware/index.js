const axios = require("axios");

let _token = null;
let _tokenExpiry = 0;

const AUTH_URL = "http://20.207.122.201/evaluation-service/auth";
const LOG_URL = "http://20.207.122.201/evaluation-service/logs";

const credentials = {
  email: "vb5066@srmist.edu.in",
  name: "vaibhav bhardwaj",
  rollNo: "ra2311028030045",
  accessCode: "QkbpxH",
  clientID: "62f55478-cac5-4819-874d-2256a5ffeeb5",
  clientSecret: "NnZAnWzbrdxeqwaw",
};

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExpiry - 60) return _token;
  const res = await axios.post(AUTH_URL, credentials);
  _token = res.data.access_token;
  _tokenExpiry = res.data.expires_in;
  return _token;
}

async function Log(stack, level, pkg, message) {
  try {
    const token = await getToken();
    await axios.post(
      LOG_URL,
      { stack, level, package: pkg, message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error("[logger] failed to ship log:", err.response?.data || err.message);
  }
}

module.exports = { Log, getToken };