const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = 8000;
dotenv.config();
const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.use(cors());
app.use(express.json());

async function run() {
  try {
    await client.connect();
    const database = client.db("medi-care-connect");
    const userCollection = database.collection("user");
    const doctorCollection = database.collection("doctor");

    //user get
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //doctor post / get /patch

    app.get("/doctor", async (req, res) => {
      const data = req.body;

      const cursor = doctorCollection.find(data);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/my/profile", async (req, res) => {
      const query = {};

      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }

      const result = await doctorCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      res.send(result[0] || {});
    });

    app.post("/doctor", async (req, res) => {
      const doctor = req.body;
      const doctorData = {
        ...doctor,
        createdAt: new Date(),
      };
      const result = await doctorCollection.insertOne(doctorData);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
