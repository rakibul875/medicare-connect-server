const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const scheduleCollection = database.collection("schedule");
    const subscriptionCollection = database.collection("subscription");
    const appointmentCollection = database.collection("appointment");
    const prescriptionCollection = database.collection("prescription");

    //user get
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //prescription post//get //patch
    app.get("/my/prescription", async (req, res) => {
      const query = {};
      if (req.query.patientId) {
        query.patientId = req.query.patientId;
      }
      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      const cursor = prescriptionCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/prescription/:id", async (req, res) => {
      const id = req.params;
      const result = await prescriptionCollection.findOne({
        _id: new ObjectId(id),
      });
      console.log(result)
      res.send(result);
    });

    app.post("/prescription", async (req, res) => {
      const data = req.body;
      const isExist = await prescriptionCollection.findOne({
        appointmentId: data.appointmentId,
      });
      if (isExist) {
        return res.send({
          success: false,
          message: "Prescription Already Exist",
        });
      }
      const prescriptionData = {
        ...data,
        prescriptionAt: new Date(),
      };
      const result = await prescriptionCollection.insertOne(prescriptionData);
      await appointmentCollection.updateOne(
        { _id: new ObjectId(data.appointmentId) },
        {
          $set: {
            AppointmentStatus: "confirmed",
          },
        },
      );
      res.send(result);
    });

    //appointment post and get api

    app.get("/appointment/:id", async (req, res) => {
      const id = req.params;
      const result = await appointmentCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get("/my/appointment", async (req, res) => {
      const query = {};
      if (req.query.userId) {
        query.userId = req.query.userId;
      }
      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      if (req.query._id) {
        query.appointmentId = req.query._id;
      }
      const cursor = appointmentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.patch("/appointment/:id", async (req, res) => {
      const id = req.params;
      const result = await appointmentCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            AppointmentStatus: "cancelled",
          },
        },
      );
      res.send(result);
    });
    app.patch("/appointment/:id/approve", async (req, res) => {
      const id = req.params;
      const result = await appointmentCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            AppointmentStatus: "approved",
          },
        },
      );
      res.send(result);
    });
    app.patch("/appointment/:id/rejected", async (req, res) => {
      const id = req.params;
      const result = await appointmentCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            AppointmentStatus: "rejected",
          },
        },
      );
      res.send(result);
    });
    // app.patch("/appointment/:id/confirmed", async (req, res) => {
    //   const id = req.params;
    //   const result = await appointmentCollection.updateOne(
    //     { _id: new ObjectId(id) },
    //     {
    //       $set: {
    //         AppointmentStatus: "Confirmed",
    //       },
    //     },
    //   );
    //   res.send(result);
    // });

    app.post("/appointment", async (req, res) => {
      const data = req.body;
      const newData = {
        ...data,
        appointmentAt: new Date(),
      };
      const result = await appointmentCollection.insertOne(newData);
      res.send(result);
    });

    //subscription post/ get

    app.get("/subscription", async (req, res) => {
      const data = req.body;
      const cursor = subscriptionCollection.find(data);
      const result = await cursor.toArray();
      res.send(result);
    });

    // await subscriptionCollection.updateMany({ amount: { $type: "string" } }, [
    //   { $set: { amount: { $toDouble: "$amount" } } },
    // ]);

    app.get("/my/subscription", async (req, res) => {
      const query = {};
      if (req.query.userId) {
        query.userId = req.query.userId;
      }
      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      const cursor = subscriptionCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/subscription", async (req, res) => {
      const { amount, doctorId, userId, sessionId, doctorName } = req.body;
      const isExist = await subscriptionCollection.findOne({ sessionId });
      if (isExist) {
        return res.send({ message: "Already exist" });
      }
      const result = await subscriptionCollection.insertOne({
        amount,
        sessionId,
        doctorId,
        userId,
        doctorName,
        paymentAt: new Date(),
      });
      res.send(result);
    });

    //schedule post//get //Patch // Delete

    app.get("/schedule", async (req, res) => {
      const query = {};
      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      const cursor = scheduleCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.delete("/schedule", async (req, res) => {
      const query = {};

      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      if (req.query.day) {
        query.day = req.query.day;
      }

      if (!query.doctorId || !query.day) {
        return res.status(400).send({
          success: false,
          message: "Both doctorId and day are strictly required for deletion!",
        });
      }

      const result = await scheduleCollection.deleteOne(query);

      if (result.deletedCount > 0) {
        res.send({ success: true, message: "Schedule deleted successfully!" });
      } else {
        res.send({
          success: false,
          message: "No matching schedule found to delete.",
        });
      }
    });

    app.patch("/schedule", async (req, res) => {
      const query = {};

      if (req.query.doctorId) {
        query.doctorId = req.query.doctorId;
      }
      if (req.query.day) {
        query.day = req.query.day;
      }

      if (!query.doctorId || !query.day) {
        return res
          .status(400)
          .send({ success: false, message: "Missing query parameters!" });
      }

      let updatedData = req.body;
      if (Array.isArray(updatedData)) {
        updatedData = updatedData[0];
      }

      if (!updatedData || !updatedData.slots) {
        return res.status(400).send({
          success: false,
          message: "Slots data is missing in req.body!",
        });
      }

      const updateDoc = {
        $set: {
          slots: updatedData.slots,
          updatedAt: new Date(),
        },
      };

      const result = await scheduleCollection.updateOne(query, updateDoc);

      if (result.modifiedCount > 0) {
        res.send({ success: true, message: "Schedule updated successfully!" });
      } else {
        res.send({
          success: false,
          message: "No changes made or schedule not found.",
        });
      }
    });

    app.post("/schedule", async (req, res) => {
      const schedule = req.body;

      const isExist = await scheduleCollection.findOne({
        doctorId: schedule[0]?.doctorId,
        day: schedule[0]?.day,
      });

      if (isExist) {
        return res.send({
          success: false,
          message: "Schedule already exists",
        });
      }
      const result = await scheduleCollection.insertMany(schedule);
      res.send({ success: true, ...result });
    });

    //doctor post / get /patch

    app.get("/doctor", async (req, res) => {
      const data = req.body;
      const cursor = doctorCollection.find(data);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/doctor/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await doctorCollection.findOne(query);
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

    app.patch("/doctor/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      const result = await doctorCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.json(result);
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
