const mongoose = require("mongoose");
const data = require("./initdata.js");
const Listing = require("../models/listing.js");
const MONGO_URL ='mongodb://127.0.0.1:27017/wonderlust';

main().then(
    () => { console.log("server connected to Db")}
).catch((err)=> {
    console.log(err);
})
async function main () {
    await mongoose.connect(MONGO_URL);
    }
const initDb = async ()=> {
    await Listing.deleteMany({});
    data.data = data.data.map((obj) =>({ ...obj , owner:"6728e391871377b5988bb47a"}));

    await Listing.insertMany(data.data);
    console.log("data was initialised");
}
initDb();