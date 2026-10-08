const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://famous-diagnostic-center.web.app",
  ],
  credentials: "true",
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7rs8zhc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("famousDB").collection("users");
    const testCollection = client.db("famousDB").collection("test");
    const doctorCollection = client.db("famousDB").collection("doctors");
    const bannerCollection = client.db("famousDB").collection("banners");
    const listingCollection = client.db("famousDB").collection("listings");
    const reviewCollection = client.db("famousDB").collection("reviews");
    const appointmentCollection = client.db("famousDB").collection("appointments");
    const technologyCollection = client
      .db("famousDB")
      .collection("technologies");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares

    // verify token middleware

    const verifyToken = (req, res, next) => {
      console.log("Inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({
          message: "unauthorized access for token",
        });
      }

      const token = req.headers.authorization.split(" ")[1];
      console.log("Inside verify token", token);

      // if (!token) {
      //   return res.status(401).send({ message: "unauthorized access" });
      // }

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({
            message: "unauthorized access",
          });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin middleware

    const verifyAdmin = async (req, res, next) => {
      // const user = req.user;

      const email = req.decoded.email;
      const query = {
        email: email,
      };
      const user = await userCollection.findOne(query);
      console.log(user);
      const isAdmin = user?.role === "Admin";

      if (!isAdmin) {
        return res.status(403).send({
          message: "forbidden access",
        });
      }
      next();
    };

    // verify doctor middleware

    const verifyDoctor = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email: email });
      const isDoctor = user?.role === "Doctor" || user?.role === "Admin";

      if (!isDoctor) {
        return res.status(403).send({
          message: "forbidden access",
        });
      }
      next();
    };

    // user related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // app.get("/users/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const result = await userCollection.findOne({ email });
    //   res.send(result);
    // });

    // for verify admin

    app.get(
      "/users/admin/:email",
      verifyToken,
      verifyAdmin,

      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({
            message: "forbidden Access",
          });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "Admin";
        }
        res.send({ admin });
      },
    );

    // get the role of the currently logged in user
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({
          message: "forbidden Access",
        });
      }
      const user = await userCollection.findOne({ email: email });
      res.send({ role: user?.role || "User" });
    });

    // admin can change a user's role (User / Doctor / Admin)
    app.patch(
      "/users/role/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { role } = req.body;
        const allowedRoles = ["User", "Doctor", "Admin"];

        if (!allowedRoles.includes(role)) {
          return res.status(400).send({ message: "Invalid role" });
        }

        const user = await userCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        if (user.email === req.decoded.email) {
          return res.status(400).send({
            message: "You cannot change your own role",
          });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } },
        );
        res.send(result);
      },
    );

    app.post("/users", async (req, res) => {
      const user = req.body;
      if (!user.role) {
        user.role = "User";
      }
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // test collection related api

    app.get("/tests", async (req, res) => {
      const result = await testCollection.find().toArray();
      res.send(result);
    });

    app.get("/tests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.findOne(query);
      res.send(result);
    });

    app.post("/tests", async (req, res) => {
      const item = req.body;
      const result = await testCollection.insertOne(item);
      res.send(result);
    });

    app.patch("/tests/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id),
      };
      updatedDoc = {
        $set: {
          name: item.name,
          price: item.price,
          testDetails: item.testDetails,
          image: item.image,
        },
      };

      const result = await testCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/tests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.deleteOne(query);
      res.send(result);
    });

    // myListing api

    app.get("/myListings", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await listingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/myListings", async (req, res) => {
      const item = req.body;
      const result = await listingCollection.insertOne(item);
      res.send(result);
    });
    app.delete("/myListings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await listingCollection.deleteOne(query);
      res.send(result);
    });

    // doctors api
    app.get("/doctors", async (req, res) => {
      const result = await doctorCollection.find().toArray();
      res.send(result);
    });

    // get a doctor profile by the linked account email
    app.get("/doctors/email/:email", async (req, res) => {
      const email = req.params.email;
      const result = await doctorCollection.findOne({ email: email });
      res.send(result);
    });

    app.get("/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorCollection.findOne(query);
      res.send(result);
    });

    app.post("/doctors", async (req, res) => {
      const item = req.body;
      const result = await doctorCollection.insertOne(item);
      res.send(result);
    });

    app.patch("/doctors/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      updatedDoc = {
        $set: {
          name: item.name,
          specialize: item.specialize,
          location: item.location,
          availableOn: item.availableOn,
          availableTime: item.availableTime,
          about: item.about,
          email: item.email,
          image: item.image,
        },
      };
      const result = await doctorCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.delete("/doctors/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorCollection.deleteOne(query);
      res.send(result);
    });

    // appointment related api
    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await appointmentCollection.find(query).toArray();
      res.send(result);
    });

    // appointments assigned to the logged in doctor
    app.get(
      "/appointments/doctor",
      verifyToken,
      verifyDoctor,
      async (req, res) => {
        const email = req.query.email;
        const result = await appointmentCollection
          .find({ doctorEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      },
    );

    app.get("/allAppointments", async (req, res) => {
      const result = await appointmentCollection.find().toArray();
      res.send(result);
    });

    app.post("/appointments", async (req, res) => {
      const item = req.body;
      item.status = "pending";
      item.paymentStatus = item.paymentStatus || "Unpaid";
      item.createdAt = new Date();
      const result = await appointmentCollection.insertOne(item);
      res.send(result);
    });

    app.patch("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { status, recommendation, reportStatus, paymentStatus } = req.body;

      const fieldsToUpdate = {};
      if (status !== undefined) fieldsToUpdate.status = status;
      if (recommendation !== undefined)
        fieldsToUpdate.recommendation = recommendation;
      if (reportStatus !== undefined) fieldsToUpdate.reportStatus = reportStatus;
      if (paymentStatus !== undefined)
        fieldsToUpdate.paymentStatus = paymentStatus;

      if (Object.keys(fieldsToUpdate).length === 0) {
        return res.send({ matchedCount: 0, modifiedCount: 0 });
      }

      const result = await appointmentCollection.updateOne(filter, {
        $set: fieldsToUpdate,
      });
      res.send(result);
    });

    app.delete("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await appointmentCollection.deleteOne(query);
      res.send(result);
    });

    // banners api
    app.get("/banners", async (req, res) => {
      const result = await bannerCollection.find().toArray();
      res.send(result);
    });

    app.get("/banners/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bannerCollection.findOne(query);
      res.send(result);
    });
    app.post("/banners", async (req, res) => {
      const item = req.body;
      const result = await bannerCollection.insertOne(item);
      res.send(result);
    });
    app.patch("/banners/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      updatedDoc = {
        $set: {
          bHeading: item.bHeading,
          bDetails: item.bDetails,
          buttonName: item.buttonName,
          image: item.image,
        },
      };
      const result = await bannerCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/banners/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bannerCollection.deleteOne(query);
      res.send(result);
    });

    // review related api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const item = req.body;
      const result = await reviewCollection.insertOne(item);
      res.send(result);
    });

    // technology related api
    app.get("/technologies", async (req, res) => {
      const result = await technologyCollection.find().toArray();
      res.send(result);
    });
    app.get("/technologies/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await technologyCollection.findOne(query);
      res.send(result);
    });
    app.post("/technologies", async (req, res) => {
      const item = req.body;
      const result = await technologyCollection.insertOne(item);
      res.send(result);
    });

    app.patch("/technologies/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      updatedDoc = {
        $set: {
          name: item.name,
          technologyDetails: item.technologyDetails,
          image: item.image,
        },
      };
      const result = await technologyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete(
      "/technologies/:id",

      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await technologyCollection.deleteOne(query);

        res.send(result);
      },
    );

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Famous Diagnostic Is Running");
});
app.listen(port, () => {
  console.log(`Famous Diagnostic Is Running on port : ${port}`);
});
