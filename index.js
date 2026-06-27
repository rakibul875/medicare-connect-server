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

const logger = (req, res, next) => {
  console.log("logger hit", req.params);
  next();
};

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
    const reviewCollection = database.collection("reviews");
    const favoriteDoctorCollection = database.collection("favorite");
    const sessionCollection = database.collection("session");

    //verification related

    const verifyToken = async (req, res, next) => {
      const authorization = req.headers?.authorization;
      if (!authorization) {
        return res.status(401).send({ message: "unauthorize access" });
      }
      const token = authorization.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorize access" });
      }
      const query = { token: token };
      const session = await sessionCollection.findOne(query);
      const userId = session?.userId;
      const userQuery = { _id: userId };
      const user = await userCollection.findOne(userQuery);
      req.user = user;
      next();
    };
    const verifyAdmin = async (req, res, next) => {
      if (req.user?.role !== "admin") {
        res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    const verifyPatientOrDoctor = (req, res, next) => {
      if (req.user?.role === "patient" || req.user?.role === "doctor") {
        return next();
      }

      return res.status(403).send({
        message: "Forbidden access",
      });
    };

    //user get

    //// ami na bujar karone support session theke kore nichi

    app.get("/analytics/top-doctors", async (req, res) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: "$doctorId",
              averageRating: { $avg: "$rating" },
              totalReviews: { $sum: 1 },
            },
          },
          {
            $sort: { averageRating: -1 },
          },
          {
            $lookup: {
              from: "doctor",
              localField: "_id",
              foreignField: "doctorId",
              as: "doctorDetails",
            },
          },
          {
            $unwind: "$doctorDetails",
          },
          {
            $project: {
              _id: 0,
              doctorId: "$_id",
              averageRating: { $round: ["$averageRating", 1] },
              totalReviews: 1,
              doctorName: "$doctorDetails.doctorName",
              specialization: "$doctorDetails.specialization",
              hospitalName: "$doctorDetails.hospitalName",
              profileImage: "$doctorDetails.profileImage",
            },
          },
        ];

        const data = await reviewCollection.aggregate(pipeline).toArray();

        res.send(data);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    ///eiporjon to

    //searching  get

    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;

      const filter = {
        _id: new ObjectId(id),
      };

      const result = await userCollection.deleteOne(filter);

      res.send(result);
    });

    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const updateUser = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateUser.status,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //favorite//doctor post and get//

    app.get("/my/favorite",verifyToken,verifyPatientOrDoctor, async (req, res) => {
      const query = {};
      if (req.query.userId) {
        query.userId = req.query.userId;
         if (req.user._id.toString() !== req.query.userId) {
            return res.status(403).send({ message: "forbidden access" });
          }
      }
      const cursor = favoriteDoctorCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/favorite", async (req, res) => {
      const data = req.body;
      const doctorId = data.doctorId;
      const userId = data.userId;
      const isExist = await favoriteDoctorCollection.findOne({
        doctorId,
        userId,
      });
      if (isExist) {
        return res.send({
          success: false,
          message: "You already add favorite this doctor",
        });
      }
      const result = await favoriteDoctorCollection.insertOne(data);
      res.send(result);
    });

    //all review get /post /patch
    app.get("/reviews", async (req, res) => {
      const data = req.body;
      const result = await reviewCollection.find(data).toArray();
      res.send(result);
    });

    app.get("/review", async (req, res) => {
      const result = await reviewCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();

      res.send(result);
    });

    app.get(
      "/my/reviews",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const query = {};
        if (req.query.userId) {
          query.userId = req.query.userId;
          if (req.user._id.toString() !== req.query.userId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        if (req.query.doctorId) {
          query.doctorId = req.query.doctorId;
          if (req.user._id.toString() !== req.query.doctorId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        const cursor = reviewCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      },
    );
    app.get("/review/:id", async (req, res) => {
      const id = req.params;
      const result = await reviewCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch(
      "/reviews/:id",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;
        const result = await reviewCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );
        res.send(result);
      },
    );

    app.post(
      "/reviews",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const data = req.body;
        const doctorId = data.doctorId;
        const userId = data.userId;
        const isExist = await reviewCollection.findOne({ doctorId, userId });
        if (isExist) {
          return res.send({
            success: false,
            message: "You already reviewed this doctor",
          });
        }
        const reviewData = {
          ...data,
          createdAt: new Date(),
        };
        const result = await reviewCollection.insertOne(reviewData);
        res.send(result);
      },
    );

    //prescription post//get //patch
    app.get(
      "/my/prescription",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const query = {};
        if (req.query.patientId) {
          query.patientId = req.query.patientId;
        }
        if (req.query.doctorId) {
          query.doctorId = req.query.doctorId;
          if (req.user._id.toString() !== req.query.doctorId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        const cursor = prescriptionCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      },
    );

    app.get("/prescription/:id", async (req, res) => {
      const id = req.params;
      const result = await prescriptionCollection.findOne({
        _id: new ObjectId(id),
      });
      console.log(result);
      res.send(result);
    });
    app.patch(
      "/prescription/:id",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;
        const result = await prescriptionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );
        res.send(result);
      },
    );

    app.post(
      "/prescription",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
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
      },
    );

    //appointment post and get api
    app.get("/appointment", async (req, res) => {
      const data = req.body;
      const result = await appointmentCollection.find(data).toArray();
      res.send(result);
    });
    app.get("/appointment/:id", async (req, res) => {
      const id = req.params;
      const result = await appointmentCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.get(
      "/my/appointment",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const query = {};
        if (req.query.userId) {
          query.userId = req.query.userId;

          if (req.user._id.toString() !== req.query.userId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        if (req.query.doctorId) {
          query.doctorId = req.query.doctorId;
          if (req.user._id.toString() !== req.query.doctorId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        if (req.query._id) {
          query.appointmentId = req.query._id;
        }
        const cursor = appointmentCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      },
    );
    app.get(
      "/today/appointment",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const query = {};
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        query.appointmentAt = {
          $gte: startOfToday,
          $lt: startOfTomorrow,
        };

        if (req.query.doctorId) {
          query.doctorId = req.query.doctorId;
          if (req.user._id.toString() !== req.query.doctorId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }

        const cursor = appointmentCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      },
    );
    app.patch("/appointment/:id",verifyToken,verifyPatientOrDoctor, async (req, res) => {
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
    app.patch("/appointment/:id/approve",verifyToken,verifyPatientOrDoctor, async (req, res) => {
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
    app.patch("/appointment/:id/rejected",verifyToken,verifyPatientOrDoctor, async (req, res) => {
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

    app.get(
      "/my/subscription",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const query = {};
        if (req.query.userId) {
          query.userId = req.query.userId;
          if (req.user._id.toString() !== req.query.userId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        if (req.query.doctorId) {
          query.doctorId = req.query.doctorId;
          if (req.user._id.toString() !== req.query.doctorId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        const cursor = subscriptionCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      },
    );

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

    app.delete(
      "/schedule",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
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
            message:
              "Both doctorId and day are strictly required for deletion!",
          });
        }

        const result = await scheduleCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.send({
            success: true,
            message: "Schedule deleted successfully!",
          });
        } else {
          res.send({
            success: false,
            message: "No matching schedule found to delete.",
          });
        }
      },
    );

    app.patch(
      "/schedule",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
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
          res.send({
            success: true,
            message: "Schedule updated successfully!",
          });
        } else {
          res.send({
            success: false,
            message: "No changes made or schedule not found.",
          });
        }
      },
    );

    app.post(
      "/schedule",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
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
      },
    );

    //doctor post / get /patch

    app.get("/doctor", async (req, res) => {
      const data = req.body;
      const cursor = doctorCollection.find(data);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/doctors", async (req, res) => {
      const result = await doctorCollection
        .find({ verificationStatus: "approved" })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();

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

    app.get(
      "/my/profile",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const query = {};

        if (req.query.doctorId) {
          query.doctorId = req.query.doctorId;
          if (req.user._id.toString() !== req.query.doctorId) {
          }
        }

        const result = await doctorCollection
          .find(query)
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        res.send(result[0] || {});
      },
    );

    //status update
    app.patch(
      "/api/doctor/:id",
      logger,
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const updateDoctor = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            verificationStatus: updateDoctor.verificationStatus,
          },
        };
        const result = await doctorCollection.updateOne(filter, updateDoc);
        res.send(result);
      },
    );

    app.patch(
      "/doctor/:id",
      verifyToken,
      verifyPatientOrDoctor,
      async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;
        const result = await doctorCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );
        res.json(result);
      },
    );

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
