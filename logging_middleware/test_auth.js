const axios = require("axios");

axios.post("http://20.207.122.201/evaluation-service/auth", {
  email: "vb5066@srmist.edu.in",
  name: "vaibhav bhardwaj",
  rollNo: "ra2311028030045",
  accessCode: "QkbpxH",
  clientID: "62f55478-cac5-4819-874d-2256a5ffeeb5",
  clientSecret: "NnZAnWzbrdxeqwaw"
})
.then(r => console.log("SUCCESS:", r.data.access_token.slice(0,30)))
.catch(e => console.error("FAIL:", JSON.stringify(e.response?.data)));